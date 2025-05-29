import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/apiError.js';
import {User} from '../models/user.models.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const registerUser = asyncHandler( async (req, res)=>{
    const {fullName, email, username, password} = req.body;
    console.log(fullName, email, username, password); 

    if(!fullName || !email || !username || !password){
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = User.findOne({$or:[{username},{email}]});

    if(existedUser){
        throw new ApiError(409, "Username or email already exists");
    }

    const avatarLocalPath=req.files?.avatar[0]?.path;
    const coverImageLocalPath=req.files?.coverPicture[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar are required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;

    if(!avatar) {
        throw new ApiError(500, "Failed to upload avatar");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        conerImage: coverImage ? coverImage.url : "",
        email,
        username: username.toLowerCase(),
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if( !createdUser) {
        throw new ApiError(500, "Failed to create user");
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser, "User registered successfully")
    )
})


export {registerUser};