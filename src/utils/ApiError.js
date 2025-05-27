class ApiError extends Error{
    constructor(
        statusCode,
        messaege="Something went wrong",
        error=[],
        statck=""
    ){
        super(messaege);
        this.statusCode = statusCode;
        this.data=null;
        this.message = messaege;
        this.success = false;
        this.errors = errors;


        if(statck){
            this.stack = statck;
        }else{
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export {ApiError};