from django.core.management.base import BaseCommand
from core.models import Exam, ExamPaper, CourseAllocation, Enrollment, User
import os
import json

class Command(BaseCommand):
    help = 'Links file system papers (Questions, Answer Keys, Scanned Scripts) to database records based on folder structure.'

    def handle(self, *args, **options):
        self.stdout.write("Starting integration of file system papers (Legacy Format)...")

        # Base paths inside the container
        DATA_DIR = "/app/Data"
        PAPERS_DIR = os.path.join(DATA_DIR, "Papers")
        MIDSEM_DIR = os.path.join(PAPERS_DIR, "MidSem")
        ENDSEM_DIR = os.path.join(PAPERS_DIR, "EndSem")
        QUESTIONS_DIR = os.path.join(PAPERS_DIR, "Questions")
        
        # 1. Map Subjects to Course Codes
        subject_map = {
            "DAA": "CS103",   # DAA folder -> CS103 (Algorithms)
            "CI": "CS202",    # CI folder -> CS202 (Artificial Intelligence)
            "HPC": "CS201",   # HPC folder -> CS201 (Machine Learning)
            "SE": "CS104",    # SE folder -> CS104 (DBMS)
            "EE": "EC201",    # EE folder -> EC201 (Digital Electronics)
            "CN": "CS101",    # CN folder -> CS101 (Intro to Programming)
        }

        # 2. Process MidSem and EndSem
        for exam_type_name, exam_type_code, base_dir in [("MidSem", "MIDSEM", MIDSEM_DIR), ("EndSem", "ENDSEM", ENDSEM_DIR)]:
            if not os.path.exists(base_dir):
                self.stdout.write(self.style.WARNING(f"Directory not found: {base_dir}"))
                continue

            self.stdout.write(f"Processing {exam_type_name}...")

            # Iterate through subject folders (e.g., SE, CN)
            for subject_folder in os.listdir(base_dir):
                subject_path = os.path.join(base_dir, subject_folder)
                
                # Skip files and Answer Key folders
                if not os.path.isdir(subject_path) or "Answer" in subject_folder:
                    continue

                course_code = subject_map.get(subject_folder)
                if not course_code:
                    self.stdout.write(self.style.WARNING(f"  Skipping {subject_folder}: No course code mapping found."))
                    continue
                
                self.stdout.write(f"  Found Subject: {subject_folder} -> {course_code}")

                # 3. Find or Create the Exam Event (Question Paper + Answer Key)
                self.link_exam_metadata(exam_type_code, subject_folder, course_code, base_dir, QUESTIONS_DIR)

                # 4. Link Student Answer Scripts
                self.link_student_scripts(exam_type_code, subject_folder, course_code, subject_path)

        self.stdout.write(self.style.SUCCESS("Integration complete!"))

    def link_exam_metadata(self, exam_type, subject_name, course_code, exam_base_dir, questions_dir):
        # Find Allocation
        allocations = CourseAllocation.objects.filter(course__course_code=course_code, session__is_active=True)
        if not allocations.exists():
             self.stdout.write(self.style.ERROR(f"    No active allocations found for {course_code}"))
             return

        # Improved Question Paper Search
        qp_path = None
        
        # Helper to find file
        def find_file(directory, patterns):
            if not os.path.exists(directory): return None
            for root, dirs, files in os.walk(directory):
                for f in files:
                    lower_f = f.lower()
                    if f.startswith('.'): continue
                    if not lower_f.endswith('.pdf'): continue
                    
                    if all(p.lower() in lower_f for p in patterns):
                        abs_path = os.path.join(root, f)
                        # Return path relative to /app/
                        if abs_path.startswith('/app/'):
                            return abs_path[5:] 
                        return abs_path
            return None

        # Define search patterns
        patterns = [subject_name]
        if exam_type == "MIDSEM":
            patterns.append("mid")
        elif exam_type == "ENDSEM":
            patterns.append("end")
        
        qp_path = find_file(questions_dir, patterns)
        
        # Fallback for CI
        if not qp_path and subject_name == "CI":
             qp_path = find_file(questions_dir, ["computational"]) # fuzzy
        
        # Find Answer Key
        ak_path = None
        ak_dir_names = ["Answer Key", "Answer Keys"]
        for ak_name in ak_dir_names:
            ak_full_dir = os.path.join(exam_base_dir, ak_name)
            if os.path.exists(ak_full_dir):
                for f in os.listdir(ak_full_dir):
                    if subject_name.lower() in f.lower() and f.endswith(".pdf"):
                        # Path relative to Django root (which is /app/)
                        # Structure: Data/Papers/MidSem/Answer Keys/File.pdf
                        exam_folder_name = os.path.basename(exam_base_dir) # MidSem
                        ak_path = os.path.join("Data/Papers", exam_folder_name, ak_name, f) 
                        break
        
        # Create/Update Exam for EACH allocation
        for allocation in allocations:
            exam, created = Exam.objects.get_or_create(
                allocation=allocation,
                exam_type=exam_type,
                defaults={
                    'total_marks': 50 if exam_type == "MIDSEM" else 100,
                    'is_active': True
                }
            )
            
            updated = False
            if qp_path and exam.question_paper_path != qp_path:
                exam.question_paper_path = qp_path
                updated = True
            
            if ak_path and exam.answer_key_path != ak_path:
                exam.answer_key_path = ak_path
                updated = True
                
            if created or updated:
                exam.save()
                self.stdout.write(f"    {'Created' if created else 'Updated'} {exam_type} Exam for {allocation}")

    def link_student_scripts(self, exam_type, subject_name, course_code, subject_images_path):
        # Get all images
        images = sorted([f for f in os.listdir(subject_images_path) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        
        if not images:
            self.stdout.write(f"    No images found in {subject_images_path}")
            return

        # Structure: ["Data/Papers/MidSem/SE/se1.jpeg", ...]
        # Prepend the relative path from /app/
        exam_folder = os.path.basename(os.path.dirname(subject_images_path)) # MidSem
        relative_images = [os.path.join("Data/Papers", exam_folder, subject_name, img) for img in images]

        # Find Enrollments
        enrollments = Enrollment.objects.filter(
            allocation__course__course_code=course_code,
            status='ACTIVE'
        )
        
        if not enrollments.exists():
            self.stdout.write(self.style.WARNING(f"    No enrollments found for {course_code}"))
            return

        # STRATEGY: Assign this ONE set of images to the FIRST student found (Demo Mode)
        target_enrollment = enrollments.first()
        student_id = target_enrollment.student.university_id
        
        self.stdout.write(f"    Assigning {len(images)} pages to Student {student_id}")

        # Find the specific Exam object
        try:
            exam = Exam.objects.get(allocation=target_enrollment.allocation, exam_type=exam_type)
        except Exam.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"    Exam not initialized for {target_enrollment.allocation}"))
            return

        # Create/Update ExamPaper
        paper, created = ExamPaper.objects.get_or_create(
            enrollment=target_enrollment,
            exam=exam,
            defaults={
                'evaluation_status': 'COMPLETED',
                'total_score': 0,
                'marks_json': {}
            }
        )

        paper.pages = relative_images
        # Force completion for visibility
        paper.evaluation_status = 'COMPLETED'
        paper.save()
        self.stdout.write(f"    Linked paper {paper.paper_id}")

