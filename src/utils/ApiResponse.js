class ApiResponse{
    constructor(status, data, message = "Success") {
        this.success = status <400 ; // Indicates a successful response
        this.statusCode = status; // HTTP status code
        this.message = message; // Response message
        this.data = data; // Optional data payload
    }
}