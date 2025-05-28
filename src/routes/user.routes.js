import {Router} from 'express';
import { registerUser } from '../controllers/user.controllers.js';

const app = Router();

app.route('/register').post(registerUser)


export default app;