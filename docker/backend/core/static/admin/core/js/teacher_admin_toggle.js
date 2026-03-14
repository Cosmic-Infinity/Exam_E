(function () {
  function toggleCoordinatedCourse() {
    var coordinatorCheckbox = document.getElementById("id_is_coordinator");
    var courseField = document.getElementById("id_coordinated_course");

    if (!coordinatorCheckbox || !courseField) {
      return;
    }

    var shouldEnable = coordinatorCheckbox.checked;
    courseField.disabled = !shouldEnable;

    if (!shouldEnable) {
      courseField.value = "";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var coordinatorCheckbox = document.getElementById("id_is_coordinator");
    if (!coordinatorCheckbox) {
      return;
    }

    toggleCoordinatedCourse();
    coordinatorCheckbox.addEventListener("change", toggleCoordinatedCourse);
  });
})();
