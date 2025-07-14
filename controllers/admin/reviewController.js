const reviewModel=require('../../modal/admin/review.medal')
// Get all reviews for a specific product and user
module.exports.getReviews = async (req, res) => {
  // Get filters from the request (query parameters or body)
  const filters = {
    status: req.query.status || '',  // Default: all status
    search: req.query.search || '',  // Default: no search
    deleted: req.query.deleted || 0, // Default: show only non-deleted
    limit: parseInt(req.query.limit) || 25, // Default: 25 reviews per page
    offset: parseInt(req.query.offset) || 0, // Default: offset 0
  };

  try {
    const reviews = await reviewModel.getAllReview(filters);
    
    if (reviews.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
    }
    return res.status(200).json(reviews);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Lỗi khi lấy đánh giá' });
  }
};



// change Status
 module.exports.changeStatus = async (req, res) => {
   const { status, id } = req.params;
  const newStatus = status === 'active' ? 'inactive' : 'active';

  try {
    await reviewModel.updateProductStatus(id, newStatus); // truyền đúng newStatus
    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Lỗi khi đổi trạng thái:', err);
    res.status(500).json({ error: 'Đổi trạng thái thất bại' });
  }
  // console.log('Status:', status);
  // console.log('ID:', id);

  // res.send(`Status: ${status}, ID: ${id}`);

  // res.redirect
}

module.exports.changeMulti = async (req,res) => {
  const{ ids,status}=req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Danh sách sản phẩm không hợp lệ' });
  }

  try {
    // Cập nhật trạng thái cho tất cả sản phẩm được chọn
    await  reviewModel.updateProductsStatusMulti(ids, status);
    res.json({ success: true, message: `Đã cập nhật trạng thái cho ${ids.length} sản phẩm.` });
  } catch (err) {
    console.error('Lỗi khi đổi trạng thái:', err);
    res.status(500).json({ error: 'Đổi trạng thái thất bại' });
  }
  
}
module.exports.deleteId= async (req,res)=>{

  const id=req.params.id;
  try {
    const result = await reviewModel.deleteItem(id);

    if (result.affectedRows > 0) {
      res.json({ success: true, message: 'Đã xoá sản phẩm thành công' });
    } else {
      res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm để xoá' });
    }
  } catch (error) {
    console.error('Lỗi khi xoá sản phẩm:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xoá sản phẩm' });
  }
}

module.exports.deleteMultiple =async(req,res)=>{
  const {ids}=req.body;
  try {
    const result=await reviewModel.deleteAll(ids);
    res.json({success:true,affectedRows:result.affectedRows});
  }
  catch(error)
  {
      res.status(400).json({ success: false, message: error.message || 'Lỗi server khi xóa sản phẩm' });

  }
}

