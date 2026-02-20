from django import forms
from django.forms.widgets import Widget
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.core.exceptions import ValidationError
import json
from .models import Exam, User


# ── Admin user forms ──────────────────────────────────────────────────────────

class UserCreationForm(forms.ModelForm):
    """Form used by UserAdmin to create a new user with a hashed password."""
    password1 = forms.CharField(label='Password',  widget=forms.PasswordInput)
    password2 = forms.CharField(label='Confirm password', widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ('university_id', 'full_name', 'email', 'role',
                  'is_active', 'is_staff', 'is_superuser', 'is_verified')

    def clean_password2(self):
        p1 = self.cleaned_data.get('password1')
        p2 = self.cleaned_data.get('password2')
        if p1 and p2 and p1 != p2:
            raise ValidationError('Passwords do not match.')
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user


class UserChangeForm(forms.ModelForm):
    """Form used by UserAdmin to edit an existing user."""
    password = ReadOnlyPasswordHashField(
        label='Password',
        help_text=(
            'Passwords are stored hashed. Use the '
            '<a href="../password/">change password form</a> to set a new one.'
        ),
    )

    class Meta:
        model = User
        fields = ('university_id', 'full_name', 'email', 'role', 'password',
                  'is_active', 'is_staff', 'is_superuser', 'is_verified')

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
        # The widget sends a JSON string, but Django's JSONField might expect dict if auto-conversion happens?
        # Actually, if the widget returns a string in the hidden input, Django form processing for JSONField usually handles JSON.loads.
        # But my widget might be sending the value via a name that match the field.
        # Let's ensure it's valid structure
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                raise forms.ValidationError("Invalid JSON schema")
        return data
