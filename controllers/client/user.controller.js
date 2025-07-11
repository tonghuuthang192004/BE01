const md5 = require('md5');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../../modal/client/user.model');
const bcrypt = require('bcrypt');

// ✉️ Cấu hình gửi mail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 📋 Regex kiểm tra mật khẩu mạnh
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
// 📋 Regex kiểm tra
const phoneRegex = /^0\d{9}$/; // ✅ Bắt đầu bằng 0 và đủ 10 số
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // ✅ Email đơn giản chuẩn
const userController = {
  // 📝 Đăng ký
  // 📝 Đăng ký
register: async (req, res) => {
  const { email, mat_khau, ten, so_dien_thoai } = req.body;

  try {
    // ✅ Validate dữ liệu
    if (!ten || ten.trim() === '') {
      return res.status(400).json({ error: 'Tên không được để trống' });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }

    if (!phoneRegex.test(so_dien_thoai)) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ (bắt đầu bằng 0, đủ 10 số)' });
    }

    if (!strongPasswordRegex.test(mat_khau)) {
      return res.status(400).json({
        error: 'Mật khẩu yếu (ít nhất 8 ký tự, chữ hoa, chữ thường, số, ký tự đặc biệt)'
      });
    }

    const userExists = await User.findByEmail(email);
    if (userExists) {
      return res.status(400).json({ error: 'Email đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(mat_khau, 10);
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

    await User.create({
      id_vai_tro: 2, // User mặc định
      email,
      mat_khau: hashedPassword,
      ten,
      so_dien_thoai,
      ma_xac_minh: verificationCode
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Xác minh tài khoản',
      html: `<p>Mã xác minh của bạn: <b>${verificationCode}</b><br>Hết hạn sau 5 phút.</p>`
    });

    res.status(201).json({ message: 'Đăng ký thành công, kiểm tra email để xác minh.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi đăng ký' });
  }
},

  // ✅ Xác minh email
  verifyEmail: async (req, res) => {
    const { email, ma_xac_minh } = req.body;

    try {
      const user = await User.findByEmail(email);
      if (!user) return res.status(400).json({ error: 'Email hoặc mã xác minh không hợp lệ' });

      // ⚠️ Check mã và thời gian hết hạn
      if (
        user.ma_xac_minh !== ma_xac_minh ||
        new Date() > new Date(user.otp_expires)
      ) {
        return res.status(400).json({ error: 'Mã xác minh không hợp lệ hoặc đã hết hạn' });
      }

      await User.verifyEmail(user.id_nguoi_dung);

      const token = jwt.sign({ id: user.id_nguoi_dung }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({ message: 'Xác minh thành công', token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi server khi xác minh email' });
    }
  },

  // 🔓 Đăng nhập
  login: async (req, res) => {
    const { email, mat_khau } = req.body;

    try {
      const user = await User.findByEmail(email);
      if (!user) return res.status(400).json({ error: 'Email hoặc mật khẩu không đúng' });

      if (!user.xac_thuc_email) {
        return res.status(403).json({ error: 'Tài khoản chưa xác minh email' });
      }

      const isMatch = await bcrypt.compare(mat_khau, user.mat_khau);
      if (!isMatch) return res.status(400).json({ error: 'Email hoặc mật khẩu không đúng' });

      const token = jwt.sign({ id: user.id_nguoi_dung }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({ message: 'Đăng nhập thành công', token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi server khi đăng nhập' });
    }
  },

  // ✏️ Cập nhật tên & số điện thoại
  updateProfile: async (req, res) => {
    const userId = req.user.id;
    const { ten, so_dien_thoai } = req.body;

    try {
      await User.updateProfile(userId, ten, so_dien_thoai);
      res.json({ message: 'Cập nhật thông tin thành công' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi server khi cập nhật thông tin' });
    }
  },

  // 🖼 Cập nhật avatar
  uploadAvatar: async (req, res) => {
    try {
      const userId = req.user.id;
      const avatarPath = `/uploads/avatars/${req.file.filename}`;
      await User.updateAvatar(userId, avatarPath);

      res.json({ success: true, avatarUrl: avatarPath, message: 'Cập nhật avatar thành công' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Lỗi server khi upload avatar' });
    }
  },

  // 🔒 Đổi mật khẩu
 changePassword : async (req, res) => {
  const userId = req.user.id; // lấy từ middleware auth
  const { oldPassword, newPassword } = req.body;

  // 🔒 Kiểm tra mật khẩu mạnh
  if (!strongPasswordRegex.test(newPassword)) {
    return res.status(400).json({
      success: false,
      message: '❌ Mật khẩu mới yếu (ít nhất 8 ký tự, chữ hoa, chữ thường, số, ký tự đặc biệt)',
    });
  }

  try {
    // 🔍 Lấy thông tin người dùng
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ Người dùng không tồn tại',
      });
    }

    // 🔑 So sánh mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword, user.mat_khau);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: '❌ Mật khẩu cũ không đúng',
      });
    }

    // ⛔ Không cho phép mật khẩu mới trùng mật khẩu cũ
    const isSame = await bcrypt.compare(newPassword, user.mat_khau);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: '⚠️ Mật khẩu mới không được trùng với mật khẩu hiện tại',
      });
    }

    // 🔒 Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 💾 Cập nhật mật khẩu
    await User.updatePassword(userId, hashedPassword);

    res.json({
      success: true,
      message: '✅ Đổi mật khẩu thành công',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: '❌ Lỗi server khi đổi mật khẩu',
    });
  }
},

  // 🔑 Quên mật khẩu
  forgotPassword: async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Email chưa được đăng ký.' 
      });
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    await User.updateOtp(user.id_nguoi_dung, otpCode);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu',
      html: `<p>Mã OTP của bạn: <b>${otpCode}</b><br>Hết hạn sau 5 phút.</p>`
    });

    res.json({ 
      success: true,
      message: '✅ Mã OTP đã được gửi đến email.' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      error: 'Lỗi server khi gửi OTP.' 
    });
  }
},


  // 🔑 Xác minh OTP
  verifyOtp: async (req, res) => {
    const { email, otpCode } = req.body;

    try {
      const user = await User.findByEmail(email);
      if (!user) return res.status(400).json({ error: 'Mã OTP không hợp lệ' });

      if (
        user.ma_xac_minh !== otpCode ||
        new Date() > new Date(user.otp_expires)
      ) {
        return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
      }

      await User.clearOtp(user.id_nguoi_dung);
      res.json({ message: 'Xác minh OTP thành công' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi server khi xác minh OTP' });
    }
  },

  // 🔑 Reset mật khẩu
  resetPassword: async (req, res) => {
  const { email, ma_xac_minh, newPassword } = req.body;

  // 🛡 Kiểm tra mật khẩu mạnh
  if (!strongPasswordRegex.test(newPassword)) {
    return res.status(400).json({
      success: false,
      error: '⚠️ Mật khẩu yếu (ít nhất 8 ký tự, chữ hoa, chữ thường, số, ký tự đặc biệt)',
    });
  }

  try {
    // 📌 Tìm người dùng
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '❌ Email không hợp lệ',
      });
    }

    // 🔑 Kiểm tra mã OTP
    if (!user.ma_xac_minh) {
      return res.status(400).json({
        success: false,
        error: '❌ Mã OTP chưa được yêu cầu hoặc đã bị xoá.',
      });
    }

    if (
      user.ma_xac_minh !== ma_xac_minh ||
      new Date() > new Date(user.otp_expires)
    ) {
      return res.status(400).json({
        success: false,
        error: '❌ Mã OTP không hợp lệ hoặc đã hết hạn.',
      });
    }

    // 🔒 Băm mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 📥 Cập nhật mật khẩu
    await User.updatePassword(user.id_nguoi_dung, hashedPassword);

    // 🧹 Xoá OTP sau khi đổi mật khẩu thành công
    await User.clearOtp(user.id_nguoi_dung);

    res.json({
      success: true,
      message: '✅ Đặt lại mật khẩu thành công!',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: '💥 Lỗi server khi đặt lại mật khẩu',
    });
  }
},

  // 📄 Lấy thông tin user hiện tại
  getCurrentUser: async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'Người dùng không tồn tại' });
      res.json({ success: true, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi server khi lấy thông tin user' });
    }
  }
};

module.exports = userController;
