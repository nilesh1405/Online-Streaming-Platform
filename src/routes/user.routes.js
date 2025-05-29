import {Router} from 'express';
import { registerUser } from '../controllers/user.controllers.js';
import { upload } from '../middlewares/multer.middlewares.js';

const app = Router();

app.route('/register').post(
    upload.fields([
        { name: 'avatar', maxCount: 1 },
        { name: 'coverPicture', maxCount: 1 }
    ]),    
    registerUser
)


export default app;