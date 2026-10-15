"use client";

import { useEffect } from "react";

export default function BlogRegistrationHandler() {
  useEffect(() => {
    // 1. Define global handlers on window for maximum reliability
    const handleSubmit = async (form: HTMLFormElement, e?: Event) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const container = form.closest(".blog-inquiry-widget") || form.parentElement;
      const errorBox = container?.querySelector(".blog-form-error") as HTMLElement | null;
      const successBox = container?.querySelector(".blog-form-success") as HTMLElement | null;
      const submitBtn = form.querySelector("button[type='submit']") as HTMLButtonElement | null;
      const btnText = submitBtn?.querySelector(".btn-text") as HTMLElement | null;
      const btnArrow = submitBtn?.querySelector(".btn-arrow") as HTMLElement | null;

      // Clear previous error
      if (errorBox) {
        errorBox.textContent = "";
        errorBox.classList.add("hidden");
      }

      // Collect form fields
      const formData = new FormData(form);
      const data: Record<string, any> = {};
      formData.forEach((value, key) => {
        data[key] = typeof value === "string" ? value.trim() : value;
      });

      // Basic client-side validation
      const name = data.name || data.student_name || data.full_name;
      const phone = data.phone || data.mobile || data.whatsapp || data.contact;
      const email = data.email;
      const country = data.country || data.target_country || data.destination;
      const amount = data.amount || data.loan_amount;

      if (!name) {
        if (errorBox) {
          errorBox.textContent = "Please enter your full name.";
          errorBox.classList.remove("hidden");
        }
        const nameInput = form.querySelector("input[name='name'], input[name='phone']") as HTMLInputElement | null;
        nameInput?.focus();
        return false;
      }

      if (!phone || String(phone).replace(/\D/g, "").length < 8) {
        if (errorBox) {
          errorBox.textContent = "Please enter a valid mobile / WhatsApp number (min 8 digits).";
          errorBox.classList.remove("hidden");
        }
        const phoneInput = form.querySelector("input[name='phone'], input[name='mobile']") as HTMLInputElement | null;
        phoneInput?.focus();
        return false;
      }

      // Enter loading state
      const originalBtnContent = submitBtn?.innerHTML || "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.75";
        submitBtn.style.cursor = "not-allowed";
        if (btnText) {
          btnText.textContent = "Registering Application...";
        } else {
          submitBtn.textContent = "Registering Application...";
        }
        if (btnArrow) btnArrow.style.display = "none";
      }

      try {
        const payload = {
          name,
          phone,
          mobile: phone,
          email: email || undefined,
          country: country || undefined,
          amount: amount || undefined,
          blogTitle: data.blogTitle || document.title || "Blog Article",
          blogSlug: data.blogSlug || window.location.pathname,
          source: data.source || "blog_registration_form",
          details: data,
        };

        const res = await fetch("/api/blogs/inquiry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok && !json?.success) {
          throw new Error(json?.message || "Failed to submit registration. Please try again.");
        }

        // Success transition: hide form and show success card
        form.classList.add("hidden");
        if (successBox) {
          successBox.classList.remove("hidden");
          const nameSpan = successBox.querySelector(".lead-submitted-name");
          if (nameSpan) {
            nameSpan.textContent = name;
          }
          try {
            successBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
          } catch {}
        }

        form.reset();
      } catch (err: any) {
        console.error("Blog form submission error:", err);
        if (errorBox) {
          errorBox.textContent = err.message || "An unexpected error occurred. Please try again.";
          errorBox.classList.remove("hidden");
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
          submitBtn.style.cursor = "pointer";
          submitBtn.innerHTML = originalBtnContent;
        }
      }

      return false;
    };

    const handleReset = (btn: HTMLElement) => {
      const container = btn.closest(".blog-inquiry-widget") || btn.parentElement?.parentElement;
      const form = container?.querySelector("form.blog-inquiry-form") as HTMLFormElement | null;
      const successBox = container?.querySelector(".blog-form-success") as HTMLElement | null;
      const errorBox = container?.querySelector(".blog-form-error") as HTMLElement | null;

      if (successBox) successBox.classList.add("hidden");
      if (errorBox) errorBox.classList.add("hidden");
      if (form) {
        form.classList.remove("hidden");
        form.reset();
      }
    };

    (window as any).handleBlogLeadSubmit = handleSubmit;
    (window as any).resetBlogLeadForm = handleReset;

    // 2. Delegate submit events on document to ensure forms are intercepted
    const onFormSubmit = (e: SubmitEvent) => {
      const target = e.target as HTMLElement | null;
      const form = target?.closest("form.blog-inquiry-form") as HTMLFormElement | null;
      if (form) {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit(form, e);
      }
    };

    const onResetClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest(".btn-reset-inquiry") as HTMLElement | null;
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        handleReset(btn);
      }
    };

    document.addEventListener("submit", onFormSubmit as any, true);
    document.addEventListener("click", onResetClick, true);

    return () => {
      document.removeEventListener("submit", onFormSubmit as any, true);
      document.removeEventListener("click", onResetClick, true);
    };
  }, []);

  return null;
}
