document.querySelectorAll('form[data-preview-form]').forEach((form) => {
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  form.after(status);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    if (button) button.disabled = true;
    try {
      const result = await fetch(form.action, {
        method: 'POST',
        body: new URLSearchParams(new FormData(form))
      });
      status.textContent = await result.text();
      if (result.ok) form.reset();
    } catch {
      status.textContent = 'The local preview is unavailable. Please try again.';
    } finally {
      status.hidden = false;
      if (button) button.disabled = false;
    }
  });
});
