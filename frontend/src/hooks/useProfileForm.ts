import { useState } from "react";

export interface ProfileFormData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  employeeId: string;
  department: string;
  position: string;
}

export function useProfileForm(initialData: ProfileFormData) {
  const [profileData, setProfileData] = useState<ProfileFormData>(initialData);

  function handleProfileChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    if (name === "phone") {
      let numbers = value.replace(/\D/g, "");

      if (numbers.startsWith("63")) {
        numbers = numbers.slice(2);
      }

      numbers = numbers.slice(0, 10);

      let formatted = "+63";
      if (numbers.length > 0) {
        formatted += " " + numbers.slice(0, 3);
      }
      if (numbers.length >= 4) {
        formatted += " " + numbers.slice(3, 6);
      }
      if (numbers.length >= 7) {
        formatted += " " + numbers.slice(6, 10);
      }

      setProfileData((current) => ({
        ...current,
        phone: formatted,
      }));
      return;
    }

    setProfileData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  return { profileData, setProfileData, handleProfileChange };
}
