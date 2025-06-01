import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/apiError.js';
import {User} from '../models/user.models.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshTokens = async (userId) => {
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    }catch(error) {
        throw new ApiError(500, "Failed to generate tokens");
    }
}

const registerUser = asyncHandler( async (req, res)=>{
    const {fullName, email, userName, password} = req.body;

    if(fullName==="" || email==="" || userName==="" || password===""){

        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({$or:[{userName},{email}]});

    if(existedUser){
        throw new ApiError(409, "Username or email already exists");
    }

    // const avatarLocalPath=req.files?.avatar[0]?.path;
    // const coverImageLocalPath=req.files?.coverImage[0]?.path;

    let avatarLocalPath;
    if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0].path;
    }

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }
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
        coverImage: coverImage ? coverImage.url : "",
        email,
        userName: userName.toLowerCase(),
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

const loginUser = asyncHandler(async (req, res) => {
    const {email, userName, password} = req.body;
    if(!(email || userName)) {
        throw new ApiError(400, "Email or username and password are required");
    }   

    if(!password) {
        throw new ApiError(400, "Password is required");
    }

    const existedUser = await User.findOne({$or:[{email},{userName}]});

    if(!existedUser) {
        throw new ApiError(404, "User not found");
    }
    const isPasswordValid = await existedUser.isPasswordCorrect(password);

    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(existedUser._id);

    const loggedInUser = await User.findById(existedUser._id).select(
        "-password -refreshToken"
    );

    const options={
        httpOnly: true,
        secure:true,
    }
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200,
            {
                existedUser: loggedInUser,
                accessToken,
                refreshToken
            },
             "User logged in successfully")
        );
});

const logoutUser= asyncHandler(async (req,res)=>{
    User.findByIdAndUpdate(req.user._id,
        {
            $set: { refreshToken: undefined },
        },
        {
            new: true,
        }
    )

    const options={
        httpOnly: true,
        secure:true,
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200,
            {},
            "User logged out successfully")
        );
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incommingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if( !incommingRefreshToken) {
        throw new ApiError(401, "Refresh token is required");
    }

    try {
        const decoded = jwt.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        if(!decoded) {
            throw new ApiError(401, "Invalid refresh token");
        }
    
        const user = await User.findById(decoded._id).select("-password -refreshToken");
        if(!user) {
            throw new ApiError(404, "User not found");
        }
    
        if(user.refreshToken !== incommingRefreshToken) {
            throw new ApiError(401, "Invalid refresh token");
        }
    
        const options = {
            httpOnly: true,
            secure: true,
        };
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, {
                accessToken,
                refreshToken: newRefreshToken
            }, 
            "Access token refreshed successfully")
        );
    } catch (error) {
        throw new ApiError(401, error?.message || "Unauthorized access");
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body;
    if(!oldPassword || !newPassword) {
        throw new ApiError(400, "Old password and new password are required");
    }
    const user = await User.findById(req.user._id);
    if(!user) {
        throw new ApiError(404, "User not found");
    }
    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid old password");
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
})

const getCurrentUser = asyncHandler(async (req,res)=>{
    res.status(200).json(
        new ApiResponse(200, req.user, "Current user fetched successfully")
    );
})

const updateAccountDetails = asyncHandler (async (req,res)=>{
    const {fullName, email}= req.body;
    if(!fullName || !email) {
        throw new ApiError(400, "Full name and email are required");
    }

    const user = await User.findById(req.user._id);
    if(!user) {
        throw new ApiError(404, "User not found");
    }
    user.fullName = fullName;
    user.email = email;
    await User.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, user, "Account details updated successfully")
    )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.files?.path;
    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar) {
        throw new ApiError(500, "Failed to upload avatar");
    }

    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: { avatar: avatar.url },
    }, {
        new: true,
    }).select("-password");
    return res.status(200).json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
});

const updateUserProfile = asyncHandler(async (req, res) => {
    const profileImageLocalPath = req.files?.path;
    if(!profileImageLocalPath) {
        throw new ApiError(400, "Profile image is required");
    }
    const profileImage = await uploadOnCloudinary(profileImageLocalPath);
    if(!profileImage) {
        throw new ApiError(500, "Failed to upload profile image");
    }
    const user  = await User.findByIdAndUpdate(req.user._id, {
        $set: { profileImage: profileImage.url },
    }, {
        new: true,
    }).select("-password");
    return res.status(200).json(
        new ApiResponse(200, user, "Profile image updated successfully")
    );
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar,
    updateUserProfile,
};