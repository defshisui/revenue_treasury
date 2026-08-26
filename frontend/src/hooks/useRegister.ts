import { useState } from "react";
import type { FormEvent } from "react";
import { API_BASE_URL } from "../config/api";

export function useRegister(onSuccess: () => void) {
  // Registration View & Step State (1: Account, 2: Personal, 3: Address, 4: Review)
  const [regStep, setRegStep] = useState(1);
  
  // Registration Form Fields
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
  
  const [regMessage, setRegMessage] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [isWorkerNotice, setIsWorkerNotice] = useState(false);

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

  const handleFinalRegisterSubmit = async () => {
    setRegMessage("");

    try {
      const userRes = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullname: `${firstName} ${lastName}`.trim(),
          username: regEmail.trim(),
          password: regPassword,
          role: "citizen"
        })
      });

      const userText = await userRes.text();
      let userData;
      try {
        userData = JSON.parse(userText);
      } catch (err) {
        throw new Error(`Server error on /users route: ${userText.slice(0, 100)}`);
      }

      if (!userRes.ok) {
        setRegMessage(userData.message || "Failed to create user account.");
        return;
      }

      const newUserId = userData.user?.id || userData.id;
      if (!newUserId) {
        throw new Error("User account was created, but server response missing user ID.");
      }

      const citizenRes = await fetch(`${API_BASE_URL}/citizens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newUserId,
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
          mobileNumber
        })
      });

      const citizenText = await citizenRes.text();
      let citizenData;
      try {
        citizenData = JSON.parse(citizenText);
      } catch (err) {
        throw new Error(`Server error on /citizens route: ${citizenText.slice(0, 100)}`);
      }

      if (!citizenRes.ok) {
        setRegMessage(citizenData.message || "User created, but failed to save citizen profile.");
        return;
      }

      setRegSuccess(true);
      setRegMessage("Registration successful! Redirecting to login...");
      setTimeout(() => {
        setRegStep(1);
        setRegSuccess(false);
        setRegMessage("");
        onSuccess();
      }, 2500);

    } catch (err: any) {
      setRegMessage(err.message || "Network error during registration process.");
    }
  };

  const handleWorkerClick = () => {
    setIsWorkerNotice(true);
    setRegSuccess(false);
    setRegMessage("To register as a worker you must contact leonkennedy@gmail.com");
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
    handleNextStep, handlePrevStep, handleFinalRegisterSubmit, handleWorkerClick
  };
}
