const express = require('express');
const router = express.Router();
const Reviewcontroller=require('../../controllers/admin/reviewController')
router.get('/',Reviewcontroller.getReviews);



router.put('/change-status/:status/:id', Reviewcontroller.changeStatus);
router.put('/change-multi',Reviewcontroller.changeMulti);
router.delete('/deleted/:id',Reviewcontroller.deleteId);
router.delete('/delete-multiple',Reviewcontroller.deleteMultiple)
  

module.exports = router;
