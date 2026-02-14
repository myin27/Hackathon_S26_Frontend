// script.js

const input = document.getElementById("fileUpload");
        const preview = document.getElementById("preview");
    
        input.addEventListener("change", () => {
        const file = input.files[0];
        if (file) {
            preview.src = URL.createObjectURL(file);
            preview.style.display = "block";
        }
});
