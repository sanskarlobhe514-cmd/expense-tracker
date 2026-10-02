// Signup redirect
createUserWithEmailAndPassword(auth, email, password)
  .then(() => {
    alert("Signup successful!");
    window.location.href = "signin.html"; // go to login page
  })
  .catch(err => alert(err.message));

// Login redirect
signInWithEmailAndPassword(auth, email, password)
  .then(() => {
    alert("Login successful!");
    window.location.href = "index.html"; // go to dashboard
  })
  .catch(err => alert(err.message));
