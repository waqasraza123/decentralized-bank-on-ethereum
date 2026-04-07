import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { UserService } from "./user.service";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async getUserById(
    @Param("id") id: string,
    @Req() req: { user: { id: string } }
  ): Promise<CustomJsonResponse> {
    const authenticatedUser = req.user;

    if (authenticatedUser.id !== id) {
      throw new UnauthorizedException(
        "You are not authorized to access this user"
      );
    }

    const user = await this.userService.getUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return {
      status: "success",
      message: "User retreived.",
      data: user
    };
  }
}
