from django import forms
from django.forms.widgets import Widget
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
import json
from .models import Exam, User, School, Stream
from django.contrib.auth.forms import UserCreationForm, UserChangeForm

class ExamSchemaWidget(Widget):
    template_name = 'admin/core/exam/change_form_schema_widget.html'

    def render(self, name, value, attrs=None, renderer=None):
        # Value might be a dict (from JSON) or a string (from POST)
        if value is None:
            value = ''
        elif not isinstance(value, str):
            value = json.dumps(value)
        
        context = {
            'widget': {
                'name': name,
                'value': value,
            }
        }
        # My custom template will contain the HTML and JS
        return mark_safe(render_to_string(self.template_name, context))

class ExamForm(forms.ModelForm):
    apply_to_all_sections = forms.BooleanField(
        required=False,
        label="Apply schema to all sections of this subject",
        help_text="If checked, this schema and marks configuration will be copied to all other sections of this course for the same exam type."
    )

    class Meta:
        model = Exam
        fields = '__all__'
        widgets = {
            'question_paper_schema': ExamSchemaWidget(),
        }

    def clean_question_paper_schema(self):
        data = self.cleaned_data['question_paper_schema']
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                raise forms.ValidationError("Invalid JSON schema")
        return data

class CSVImportForm(forms.Form):
    import_type = forms.ChoiceField(choices=[
        ('school_stream', 'Schools & Streams (School Name, School Code, Stream Name, Degree Type)'),
        ('student', 'Students (Roll No, Name, Stream, Degree, Section, Batch)'),
        ('teacher', 'Teachers (Emp ID, Name, Email, School Code, Specialization)'),
        ('course', 'Courses (Course Code, Title, Credits, Type)'),
        ('allocation', 'Allocations (Course, Teacher, Session, Section, Semester)'),
        ('enrollment', 'Enrollments (Roll No, Course Code, Session, Section, Type)'),
    ], help_text="Select the type of data you are uploading.")
    
    csv_file = forms.FileField(help_text="Upload a standard CSV file with headers matching the type.")

class PasswordFilterForm(forms.Form):
    school = forms.ModelChoiceField(
        queryset=School.objects.all(), 
        required=False,
        empty_label="All Schools",
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    stream = forms.ModelChoiceField(
        queryset=Stream.objects.all(),
        required=False,
        label="Stream",
        empty_label="--- Select a stream ---",
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    section = forms.CharField(
        max_length=10, 
        required=False, 
        label="Section (e.g., A, B)",
        widget=forms.TextInput(attrs={'class': 'form-control'})
    )
    semester = forms.IntegerField(
        required=False, 
        label="Semester",
        widget=forms.NumberInput(attrs={'class': 'form-control'})
    )
    password_algorithm = forms.ChoiceField(
        required=False,
        choices=[
            ('numeric_8', 'Numeric (8 Digits)'),
            ('alnum_10', 'Alphanumeric (10 Chars)'),
            ('uuid_12', 'Secure (12 Chars UUID)'),
        ],
        label="Password Logic",
        widget=forms.Select(attrs={'class': 'form-control'}),
        initial='numeric_8'
    )
