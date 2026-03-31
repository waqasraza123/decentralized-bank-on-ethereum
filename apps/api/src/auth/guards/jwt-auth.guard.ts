import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { AuthService } from "../auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers["authorization"] as string | undefined;

    if (!authHeader) {
      throw new UnauthorizedException("Authorization header is missing.");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new UnauthorizedException("Token is missing.");
    }

    request.user = await this.authService.validateToken(token);
    return true;
  }
}
