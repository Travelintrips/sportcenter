import React, { useState, useEffect } from "react";
import { supabase } from "./src/lib/supabase";
import { useAuthStore } from "./src/stores/authStore";

const MyProfile = () => {
  const { profile, setProfile } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone_number || "");
      setEmail(profile.email || "");
      loadAvatar();
    }
  }, [profile]);

  const loadAvatar = async () => {
    try {
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list(`user-${profile?.id}`);

      if (existingFiles && existingFiles.length > 0) {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(`user-${profile?.id}/${existingFiles[0].name}`);
        setPreviewUrl(data.publicUrl);
      }
    } catch (error) {
      console.error("Error loading avatar:", error);
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleProfileUpdate = async () => {
    if (!profile) return;

    if (fullName === profile.full_name && phone === profile.phone_number) {
      setMessage("⚠️ Tidak ada perubahan untuk disimpan.");
      return;
    }

    setLoading(true);

    try {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone_number: phone,
        })
        .eq("id", profile.id)
        .select(
          `
          id,
          role_id,
          full_name,
          phone_number,
          role:roles (
            id,
            name
          )
        `,
        )
        .single();

      if (updateError) throw updateError;

      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError) throw userError;

      const profileWithEmail = {
        ...updatedProfile,
        email: userData.user.email,
      };

      setProfile(profileWithEmail);
      setMessage("✅ Profil berhasil diperbarui");
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("❌ Gagal memperbarui profil");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailUpdate = async () => {
    if (!email || !email.includes("@")) {
      setMessage("❌ Format email tidak valid");
      return;
    }
    const { error } = await supabase.auth.updateUser({ email });
    setMessage(
      error ? "❌ Gagal update email" : "✅ Email berhasil diperbarui",
    );
  };

  const handlePasswordUpdate = async () => {
    if (!password) return;
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(
      error ? "❌ Gagal update password" : "✅ Password berhasil diperbarui",
    );
    setPassword("");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    try {
      // Delete existing avatar if any
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list(`user-${profile.id}`);

      if (existingFiles && existingFiles.length > 0) {
        await supabase.storage
          .from("avatars")
          .remove(existingFiles.map((f) => `user-${profile.id}/${f.name}`));
      }

      // Upload new avatar
      const fileExt = file.name.split(".").pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `user-${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setPreviewUrl(data.publicUrl);
      setMessage("✅ Gambar berhasil diupload");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setMessage("❌ Gagal mengupload gambar");
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">My Profile</h2>
        <a
          href="/"
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-gray-700 border border-gray-300"
        >
          🏠 Back to Home
        </a>
      </div>

      <div className="space-y-4 text-sm text-gray-800">
        {/* Foto Profil */}
        <div>
          <label className="block font-semibold mb-1">Profile Picture</label>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Avatar"
              className="h-24 w-24 rounded-full mb-2 object-cover"
            />
          ) : (
            <img
              src="/default-avatar.png"
              alt="Default Avatar"
              className="h-24 w-24 rounded-full mb-2 object-cover"
            />
          )}

          <input type="file" accept="image/*" onChange={handleAvatarUpload} />
        </div>

        {/* Nama */}
        <div>
          <label className="block font-semibold mb-1">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>

        {/* Telepon */}
        <div>
          <label className="block font-semibold mb-1">Phone Number</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block font-semibold mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <button
            onClick={handleEmailUpdate}
            className="mt-2 w-full bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
          >
            Update Email
          </button>
        </div>

        {/* Password */}
        <div>
          <label className="block font-semibold mb-1">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <button
            onClick={handlePasswordUpdate}
            className="mt-2 w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Change Password
          </button>
        </div>

        {/* Simpan Profil */}
        <button
          onClick={handleProfileUpdate}
          disabled={loading}
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          {loading ? "Saving..." : "Save Profile Changes"}
        </button>

        {message && <p className="text-sm mt-3">{message}</p>}
      </div>
    </div>
  );
};

export default MyProfile;
