import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import auth from "../firebase/auth";
import db from "../firebase/firestore";

function Register() {
  const [formData, setFormData] = useState({
  firstName: "",
  middleName: "",
  lastName: "",
  sex: "",
  email: "",
  password: "",
});

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      // Save to students
      await setDoc(doc(db, "students", user.uid), {
  uid: user.uid,
  firstName: formData.firstName,
  middleName: formData.middleName,
  lastName: formData.lastName,
  sex: formData.sex,
  email: formData.email,
  role: "student",
  status: "pending",
  createdAt: serverTimestamp(),
});


      // Save to users
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: formData.email,
        role: "student",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setMessage("Registration successful!");

      // Clear form
      setFormData({
        firstName: "",
        middleName: "",
        lastName: "",
        sex: "",
        email: "",
        password: "",
      });

    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Student Registration</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "10px" }}>
          <label>First Name</label>
          <br />
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Middle Name</label>
          <br />
          <input
            type="text"
            name="middleName"
            value={formData.middleName}
            onChange={handleChange}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Last Name</label>
          <br />
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
  <label>Sex</label>
  <br />
  <select
    name="sex"
    value={formData.sex}
    onChange={handleChange}
  >
    <option value="">Select Sex</option>
    <option value="Male">Male</option>
    <option value="Female">Female</option>
  </select>
</div>

        <div style={{ marginBottom: "10px" }}>
          <label>Email</label>
          <br />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Password</label>
          <br />
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
          />
        </div>

        <button type="submit">Register</button>
      </form>

      {message && <p style={{ marginTop: "10px" }}>{message}</p>}
    </div>
  );
}

export default Register;
