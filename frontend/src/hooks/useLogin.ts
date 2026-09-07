import { useState, useEffect } from "react";
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
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);


  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [otpNotice, setOtpNotice] = useState("");

  const navigate = useNavigate();


  useEffect(() => {
    let interval: any = null;
    if (isOtpStep) {
      interval = setInterval(() => {
        setOtpExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOtpStep]);

  const formatOtpTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timeLeft > 0) return;

    setIsErrorState(false);
    setErrorMessage("");
    setOtpNotice("");
    setIsSubmittingLogin(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON response: ${text.slice(0, 100)}`);
      }

      if (response.ok) {
        if (data.requireOtp) {

          setIsOtpStep(true);
          setOtp("");
          setOtpExpirySeconds(300);
          setResendCooldown(60);
          setOtpNotice(`A 6-digit verification code was sent to ${data.email || email}.`);
        } else {

          finishSession(data);
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
        setErrorMessage(`Cannot reach server at (${API_BASE_URL}). Please verify backend is running.`);
      } else {
        setErrorMessage(error.message || "Network error. Please try again later.");
      }
    } finally {
      setIsSubmittingLogin(false);
    }
  };


  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      setIsErrorState(true);
      return;
    }

    setIsErrorState(false);
    setErrorMessage("");
    setIsVerifyingOtp(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-login-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          rememberMe,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        finishSession(data);
      } else {
        setIsErrorState(true);
        setErrorMessage(data.message || "Invalid verification code.");
      }
    } catch (error: any) {
      setIsErrorState(true);
      setErrorMessage(error.message || "Failed to verify code. Please check your network.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };


  const handleResendLoginOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp) return;

    setIsResendingOtp(true);
    setErrorMessage("");
    setIsErrorState(false);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          purpose: "LOGIN",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setOtp("");
        setOtpExpirySeconds(300);
        setResendCooldown(data.retryAfterSeconds || 60);
        setOtpNotice("A new 6-digit verification code has been sent to your email.");
      } else {
        setIsErrorState(true);
        setErrorMessage(data.message || "Failed to resend code.");
        if (data.retryAfterSeconds) {
          setResendCooldown(data.retryAfterSeconds);
        }
      }
    } catch (error: any) {
      setIsErrorState(true);
      setErrorMessage(error.message || "Network error while requesting new OTP.");
    } finally {
      setIsResendingOtp(false);
    }
  };

  const finishSession = (data: any) => {
    if (data.user) {
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      localStorage.setItem("user_role", data.user.role || "");
    }
    if (data.token) {
      localStorage.setItem("token", data.token);
    }

    const userRole = data.user?.role?.toLowerCase() || "";
    if (["admin", "treasury-staff", "auditor"].includes(userRole)) {
      navigate("/legacy-treasury");
    } else {
      navigate("/citizen-portal");
    }
  };

  const handleCancelOtp = () => {
    setIsOtpStep(false);
    setOtp("");
    setErrorMessage("");
    setIsErrorState(false);
    setOtpNotice("");
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
    setErrorMessage,
    isErrorState,
    isSubmittingLogin,
    handleLogin,
    isOtpStep,
    otp,
    setOtp,
    otpExpirySeconds,
    resendCooldown,
    isVerifyingOtp,
    isResendingOtp,
    otpNotice,
    handleVerifyLoginOtp,
    handleResendLoginOtp,
    handleCancelOtp,
    formatOtpTimer,
  };
}