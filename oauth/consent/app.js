import { appUrl, authorizationIdFromLocation, supabase } from "/auth/supabase.js";

const authorizationId = authorizationIdFromLocation();
const element = (id) => document.getElementById(id);
const approveButton = element("approve");
const denyButton = element("deny");

function setBusy(busy) {
  approveButton.disabled = busy;
  denyButton.disabled = busy;
  approveButton.setAttribute("aria-busy", String(busy));
  denyButton.setAttribute("aria-busy", String(busy));
}

function showError(message) {
  element("error").textContent = message;
  element("status").textContent = "לא ניתן להשלים את האישור.";
}

function scopeLabel(scope) {
  const scopes = Array.isArray(scope)
    ? scope
    : String(scope || "").split(/\s+/);
  return scopes.filter(Boolean).join(" · ") || "לא צוינו הרשאות";
}

async function submitDecision(method) {
  setBusy(true);
  element("error").textContent = "";
  element("status").textContent = "מעבד החלטה...";
  try {
    const { data, error } = await supabase.auth.oauth[method](authorizationId);
    if (error || !data?.redirect_url) {
      throw new Error("OAuth decision failed");
    }
    location.assign(data.redirect_url);
  } catch (error) {
    console.error("MATOK OAuth decision failed", error);
    showError("בקשת האישור נכשלה. אפשר לרענן את הדף ולנסות שוב.");
    setBusy(false);
  }
}

async function loadAuthorizationRequest() {
  if (!authorizationId) {
    showError("קישור האישור חסר או שגוי.");
    return;
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      location.replace(appUrl("/login/", authorizationId));
      return;
    }

    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data) {
      throw new Error("Authorization request lookup failed");
    }

    if (!("authorization_id" in data) && data.redirect_url) {
      location.assign(data.redirect_url);
      return;
    }

    element("client").textContent = data.client?.name || "יישום ללא שם";
    element("return-url").textContent = data.redirect_uri || "לא ידוע";
    element("scopes").textContent = scopeLabel(data.scope);
    element("details").hidden = false;
    element("status").textContent = "בחר אם לאשר את ההרשאות המוצגות.";
    setBusy(false);

    approveButton.addEventListener("click", () => submitDecision("approveAuthorization"), { once: true });
    denyButton.addEventListener("click", () => submitDecision("denyAuthorization"), { once: true });
  } catch (error) {
    console.error("MATOK OAuth consent initialization failed", error);
    showError("בקשת החיבור אינה זמינה או שפג תוקפה.");
  }
}

await loadAuthorizationRequest();
