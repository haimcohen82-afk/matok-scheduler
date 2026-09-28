import { appUrl, authorizationIdFromLocation, supabase } from "/auth/supabase.js";

const authorizationId = authorizationIdFromLocation();
const form = document.getElementById("login");
const submitButton = document.getElementById("submit");
const errorMessage = document.getElementById("error");
const passwordInput = document.getElementById("password");

if (!authorizationId) {
  errorMessage.textContent = "מזהה האישור חסר או שגוי.";
  submitButton.disabled = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authorizationId) return;

  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  errorMessage.textContent = "";
  let redirecting = false;

  try {
    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    redirecting = true;
    location.replace(appUrl("/oauth/consent/", authorizationId));
  } catch (error) {
    console.error("MATOK sign-in failed", error);
    errorMessage.textContent = "הכניסה נכשלה. ודא שחשבון MATOK קיים ושפרטיו נכונים.";
  } finally {
    passwordInput.value = "";
    if (!redirecting) {
      submitButton.disabled = false;
      submitButton.setAttribute("aria-busy", "false");
    }
  }
});
