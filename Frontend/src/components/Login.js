import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdOutlineFlipCameraAndroid } from "react-icons/md";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../context/AuthContext";
import "../assets/style.css";
import API_URL from '../config';
const Login = () => {
  const [isFlipped, setIsFlipped] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const { setUserRole, triggerSessionRefresh } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in both fields");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {

        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        if (data.user) {
  const userData = {
    _id: data.user._id,
    firstName: data.user.firstName,
    lastName: data.user.lastName,
    universityEmail: data.user.universityEmail,
    profilePic: data.user.profilePic || null,
    gender: data.user.gender || "male",
    role: data.user.role
  };

  localStorage.setItem("user", JSON.stringify(userData));
}

        setUserRole(data.role);
        triggerSessionRefresh();


        switch (data.role) {
          case "admin":
            navigate("/admin/dashboard");
            break;
          case "faculty":
            navigate("/faculty/dashboard");
            break;
          case "student":
            navigate("/student/dashboard");
            break;
          default:
            toast.error("Unknown role. Please contact admin.");
        }
      } else {
        toast.error(data.message || data.errors || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Something went wrong. Try again later.");
    }
  };

  return (
    <div className="login-container">
      <ToastContainer autoClose={3000} />

      <div className={`flip-container ${isFlipped ? "flipped" : ""}`}>
        <div className="flipper">
          <div className="login-box front">
            <div className="left-side">
              <div className="overlay"></div>
              <h2>Welcome Back</h2>
              <p>Please log in using your credentials to stay connected.</p>
            </div>
            <div className="right-side">
              <MdOutlineFlipCameraAndroid
                className="flip-icon"
                onClick={() => setIsFlipped(true)}
              />
              <h2 className="login-title">LOGIN</h2>
              <form onSubmit={handleLogin}>
                <input
                  type="email"
                  placeholder="Email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className="input-field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <span
                    className="eye-icon"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
                <button type="submit" className="btn-primary">
                  Log In
                </button>
              </form>
            </div>
          </div>

          <div className="login-box back">
            <div className="full-image">
              <div className="overlay"></div>
              <h2>Studenova</h2>
              <p>Get access to your Digital Campus, Anytime, Anywhere!</p>
              <button
                className="btn-primary"
                onClick={() => setIsFlipped(false)}
              >
                Proceed to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
