document.getElementById('login-form').addEventListener('submit', function(event) {
  event.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  // For now, we'll just check if the credentials match hardcoded values
  if (email === 'test@example.com' && password === 'password123') {
    alert('Login successful!');
    // Redirect to the landing page
    window.location.href = 'landing.html';
  } else {
    alert('Invalid credentials!');
  }
});
