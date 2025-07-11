const categoryModel = require('../../modal/client/category.model');

// 🟢 Lấy tất cả danh mục
const getAllCategories = async (req, res) => {
    try {
        const data = await categoryModel.getAllCategories();

        res.json({
            success: true,
            message: 'Lấy danh sách danh mục thành công ✅',
            data
        });
    } catch (error) {
        console.error('❌ Lỗi lấy danh mục:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh mục 😢'
        });
    }
};

// 🟢 Lấy sản phẩm theo ID danh mục
const getProductsByCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await categoryModel.getProductsByCategoryId(id);

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm nào cho danh mục này ❗'
            });
        }

        res.json({
            success: true,
            message: 'Lấy danh sách sản phẩm theo danh mục thành công ✅',
            data
        });
    } catch (error) {
        console.error('❌ Lỗi lấy sản phẩm theo danh mục:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy sản phẩm theo danh mục 😢'
        });
    }
};

module.exports = {
    getAllCategories,
    getProductsByCategory
};
