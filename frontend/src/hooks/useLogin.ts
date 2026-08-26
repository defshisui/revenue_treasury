import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

export function useLogin(
  timeLeft: number,
  setTimeLeft: React.Dispatch<React.SetStateAction<number>>
) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isErrorState, setIsErrorState] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timeLeft > 0) return;

    setIsErrorState(false);
    setErrorMessage("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          rememberMe,
        }),
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`Server returned non-JSON response: ${text.slice(0, 100)}`);
      }

      if (response.ok) {
        if (data.user) {
          localStorage.setItem("currentUser", JSON.stringify(data.user));
        }
        const userRole = data.user?.role?.toLowerCase() || "";
        if (userRole === "admin") {
          navigate("/legacy-treasury");
        } else {
          navigate("/citizen-portal");
        }
      } else {
        setIsErrorState(true);
        setErrorMessage(data.message || "Invalid credentials.");
        if (response.status === 429 && data.retryAfterSeconds) {
          setTimeLeft(data.retryAfterSeconds);
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      setIsErrorState(true);
      if (error.name === "AbortError") {
        setErrorMessage("Request timed out. Please check your connection.");
      } else if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
        setErrorMessage(`Cannot reach server at (${API_BASE_URL}). Please verify backend is running and CORS is enabled.`);
      } else {
        setErrorMessage(error.message || "Network error. Please try again later.");
      }
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    rememberMe,
    setRememberMe,
    errorMessage,
    isErrorState,
    handleLogin,
  };
}
