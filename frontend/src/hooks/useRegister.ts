// src/hooks/useRegister.ts
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { API_BASE_URL } from "../config/api";

export function useRegister(onSuccess: () => void) {
  // Registration Steps (1: Account, 2: Personal, 3: Address, 4: Review, 5: Verify Email OTP)
  const [regStep, setRegStep] = useState(1);

  // Form Fields
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [houseNoStreet, setHouseNoStreet] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [occupation, setOccupation] = useState("");
  const [sex, setSex] = useState("Male");
  const [mobileNumber, setMobileNumber] = useState("");

  // OTP Verification States
  const [regOtp, setRegOtp] = useState("");
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(300); // 5 minutes
  const [resendCooldown, setResendCooldown] = useState(60); // 60 seconds
  const [isSubmittingInit, setIsSubmittingInit] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  const [regMessage, setRegMessage] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [isWorkerNotice, setIsWorkerNotice] = useState(false);

  // Countdown timer for Registration OTP step
  useEffect(() => {
    let interval: any = null;
    if (regStep === 5) {
      interval = setInterval(() => {
        setOtpExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [regStep]);

  const formatOtpTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const validatePHMobile = (number: string) => {
    const phMobileRegex = /^09\d{9}$/;
    return phMobileRegex.test(number.trim());
  };

  const handleNextStep = (e: FormEvent) => {
    e.preventDefault();
    setRegMessage("");
    setIsWorkerNotice(false);

    if (regStep === 1) {
      if (!regEmail || !regPassword) {
        setRegMessage("Please fill in both email and password.");
        return;
      }
    } else if (regStep === 2) {
      if (!firstName || !lastName || !birthDate || !sex) {
        setRegMessage("Please fill in all required personal details.");
        return;
      }
    } else if (regStep === 3) {
      if (!houseNoStreet || !barangay || !city) {
        setRegMessage("Please fill in your complete address.");
        return;
      }
      if (!validatePHMobile(mobileNumber)) {
        setRegMessage("Please enter a valid 11-digit Philippine mobile number starting with 09 (e.g., 09123456789).");
        return;
      }
    }

    setRegStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setRegMessage("");
    setRegStep((prev) => Math.max(prev - 1, 1));
  };

  /**
   * STEP 4 Review -> Initiate Registration OTP (Dispatches Nodemailer email)
   */
  const handleFinalRegisterSubmit = async () => {
    setRegMessage("");
    setIsSubmittingInit(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          firstName,
          middleName,
          lastName,
          suffix,
          birthDate,
          houseNoStreet,
          barangay,
          city,
          occupation,
          sex,
          mobileNumber,
          role: "citizen",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRegMessage(data.message || "Failed to initiate registration verification.");
        return;
      }

      // Move to Step 5: OTP Email Verification
      setRegStep(5);
      setRegOtp("");
      setOtpExpirySeconds(300);
      setResendCooldown(60);
      setRegMessage(`A 6-digit verification code was sent to ${regEmail}.`);
    } catch (err: any) {
      setRegMessage(err.message || "Network error while sending verification code.");
    } finally {
      setIsSubmittingInit(false);
    }
  };

  /**
   * STEP 5: Verify Registration OTP -> Completes account creation in PostgreSQL
   */
  const handleVerifyRegisterOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!regOtp || regOtp.trim().length !== 6) {
      setRegMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setRegMessage("");
    setIsVerifyingOtp(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-register-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          otp: regOtp.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRegMessage(data.message || "Invalid or expired verification code.");
        return;
      }

      setRegSuccess(true);
      setRegMessage("Registration & email verification successful! Redirecting to sign in...");
      setTimeout(() => {
        setRegStep(1);
        setRegSuccess(false);
        setRegMessage("");
        onSuccess();
      }, 2500);
    } catch (err: any) {
      setRegMessage(err.message || "Network error during OTP verification.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  /**
   * Resend Registration OTP with 60s cooldown
   */
  const handleResendRegisterOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp) return;

    setIsResendingOtp(true);
    setRegMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          purpose: "REGISTER",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRegOtp("");
        setOtpExpirySeconds(300);
        setResendCooldown(data.retryAfterSeconds || 60);
        setRegMessage("A new verification code has been dispatched to your email.");
      } else {
        setRegMessage(data.message || "Failed to resend verification code.");
        if (data.retryAfterSeconds) {
          setResendCooldown(data.retryAfterSeconds);
        }
      }
    } catch (err: any) {
      setRegMessage(err.message || "Network error requesting new verification code.");
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleWorkerClick = () => {
    setIsWorkerNotice(true);
    setRegSuccess(false);
    setRegMessage("To register as a worker you must contact jomelbaisac15@gmail.com");
  };

  return {
    regStep, setRegStep,
    regEmail, setRegEmail,
    regPassword, setRegPassword,
    showRegPassword, setShowRegPassword,
    firstName, setFirstName,
    middleName, setMiddleName,
    lastName, setLastName,
    suffix, setSuffix,
    birthDate, setBirthDate,
    houseNoStreet, setHouseNoStreet,
    barangay, setBarangay,
    city, setCity,
    occupation, setOccupation,
    sex, setSex,
    mobileNumber, setMobileNumber,
    regMessage, setRegMessage,
    regSuccess, isWorkerNotice, setIsWorkerNotice,
    // OTP States
    regOtp, setRegOtp,
    otpExpirySeconds,
    resendCooldown,
    isSubmittingInit,
    isVerifyingOtp,
    isResendingOtp,
    handleNextStep,
    handlePrevStep,
    handleFinalRegisterSubmit,
    handleVerifyRegisterOtp,
    handleResendRegisterOtp,
    handleWorkerClick,
    formatOtpTimer,
  };
}
