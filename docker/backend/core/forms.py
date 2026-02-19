from django import forms
from django.forms.widgets import Widget
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
import json
from .models import Exam

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
