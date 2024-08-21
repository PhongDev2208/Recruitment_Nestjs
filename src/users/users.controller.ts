import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from './users.interface';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users') // => /users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ResponseMessage('Create user successfully')
  @Post()
  async create(@Body() userInfo: CreateUserDto, @User() userAuth: IUser) {
    const newUser = await this.usersService.create(userInfo, userAuth);
    return {
      _id: newUser._id,
      createdAt: newUser.createdAt,
    };
  }

  @Get()
  @ResponseMessage('Find all Users')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.usersService.findAll(+currentPage, +limit, qs);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Find a User')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.usersService.findOne(id);
  }

  @Patch()
  @ResponseMessage('Update a User')
  update(@Body() updateUserDto: UpdateUserDto, @User() userAuth: IUser) {
    return this.usersService.update(updateUserDto, userAuth);
  }

  @Delete(':id')
  @ResponseMessage('Delete a User')
  remove(@Param('id') id: string, @User() userAuth: IUser) {
    return this.usersService.remove(id, userAuth);
  }
}
