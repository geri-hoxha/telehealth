import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../users/user.dto';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}
