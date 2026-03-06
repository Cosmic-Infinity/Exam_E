import os

file_path = 'docker/backend/core/models.py'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'managed = False' in line:
        # Keep managed = False only if it has the specific comment for DataImport
        if 'No database table' in line:
            new_lines.append(line)
        else:
            # Skip this line (remove managed = False)
            continue
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
print(f"Processed {file_path}")
