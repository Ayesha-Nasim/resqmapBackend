import { UserModel } from "../models/userModel.js";

export const getProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await UserModel.getUserById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({ success: true, user });
  } catch (err) {
    console.error("GET PROFILE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    const updateData = {};
    if (req.body.name !== undefined) {
      updateData.name = req.body.name;
    }

    const updated = await UserModel.updateUser(userId, updateData);

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: updated,
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
};
export const getResponders = async (req, res) => {
  try {
    const responders = await UserModel.getUsersByRole("responder");

    // return safe fields only
    const clean = responders.map((u) => ({
      id: u.id,
      name: u.name || "",
      email: u.email || "",
      role: u.role,
    }));

    return res.json({ success: true, responders: clean });
  } catch (err) {
    console.error("getResponders error:", err);
    return res.status(500).json({ error: "Failed to fetch responders" });
  }
};