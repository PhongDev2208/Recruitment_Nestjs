import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User as UserM, UserDocument } from './schemas/user.schema';
import mongoose, { Model } from 'mongoose';
import { genSaltSync, hashSync, compareSync } from 'bcryptjs';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from './users.interface';
import aqp from 'api-query-params';
import { ConfigService } from '@nestjs/config';
import { Role, RoleDocument } from 'src/roles/schemas/role.schema';
import { USER_ROLE } from 'src/constans/sample';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserM.name)
    private userModel: SoftDeleteModel<UserDocument>,
    @InjectModel(Role.name)
    private roleModel: SoftDeleteModel<RoleDocument>,
    private configService: ConfigService,
  ) {}

  getHashPassword = (password: string) => {
    const salt = genSaltSync(10);
    const hash = hashSync(password, salt);
    return hash;
  };

  async create(userInfo: CreateUserDto, userAuth: IUser) {
    try {
      const { name, email, password, age, gender, address, role, company } =
        userInfo;
      // Check existed email
      const existedUser = await this.userModel.findOne({ email });
      if (existedUser) {
        throw new BadRequestException(
          `Email ${email} existed on system. Please try another email`,
        );
      }

      const hashPassword = this.getHashPassword(password);

      const user = await this.userModel.create({
        name,
        email,
        password: hashPassword,
        age,
        gender,
        address,
        role,
        company,
        createdBy: {
          _id: userAuth._id,
          email: userAuth.email,
        },
      });
      return user;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async register(user: RegisterUserDto) {
    try {
      // Check existed email
      const existedUser = await this.userModel.findOne({ email: user.email });
      if (existedUser) {
        throw new BadRequestException(
          `Email ${user.email} existed on system. Please try another email`,
        );
      }

      const hashPassword = this.getHashPassword(user.password);
      user.password = hashPassword;

      // fetch role user
      const roleUser = await this.roleModel.findOne({ name: USER_ROLE });
      user['role'] = roleUser?._id;

      const record = await this.userModel.create(user);
      return record;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    try {
      const { filter, sort, population } = aqp(qs);
      delete filter.current;
      delete filter.pageSize;

      const offset = (currentPage - 1) * limit;
      const defaultLimit = limit ? limit : 10;

      const totalItems = await this.userModel.count(filter);
      const totalPages = Math.ceil(totalItems / defaultLimit);

      const result = await this.userModel
        .find(filter)
        .skip(offset)
        .limit(defaultLimit)
        .sort(sort as any)
        .populate(population)
        .select('-password')
        .exec();

      return {
        meta: {
          current: currentPage, //trang hiện tại
          pageSize: limit, //số lượng bản ghi đã lấy
          pages: totalPages, //tổng số trang với điều kiện query
          total: totalItems, // tổng số phần tử (số bản ghi)
        },
        result, //kết quả query
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async findOne(id: string) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new NotFoundException(`User with id ${id} not found`);
      }

      return await this.userModel
        .findOne({
          _id: id,
        })
        .select('-password');
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async findOneByUsername(username: string) {
    try {
      return await this.userModel
        .findOne({
          email: username,
        })
        .populate({
          path: 'role',
          select: {
            name: 1,
          },
        });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  isValidPassword(password: string, hash: string) {
    return compareSync(password, hash);
  }

  async update(updateUserDto: UpdateUserDto, userAuth: IUser) {
    try {
      // Check existed email
      const existedUser = await this.userModel.findOne({
        email: updateUserDto.email,
      });
      if (existedUser) {
        throw new BadRequestException(
          `Email ${updateUserDto.email} existed on system. Please try another email`,
        );
      }
      return await this.userModel.updateOne(
        { _id: updateUserDto._id },
        {
          ...updateUserDto,
          updatedBy: {
            _id: userAuth._id,
            email: userAuth.email,
          },
        },
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async remove(id: string, userAuth: IUser) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new NotFoundException(`User with id ${id} not found`);
      }

      const foundUser = await this.userModel.findOne({ _id: id });
      if (
        foundUser &&
        foundUser.email == this.configService.get<string>('ADMIN_EMAIL')
      ) {
        throw new BadRequestException(`Can not remove admin account`);
      }

      await this.userModel.updateOne(
        {
          _id: id,
        },
        {
          deletedBy: {
            _id: userAuth._id,
            email: userAuth.email,
          },
        },
      );

      return await this.userModel.softDelete({
        _id: id,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  updateUserToken = async (refreshToken: string, _id: string) => {
    try {
      return await this.userModel.updateOne({ _id }, { refreshToken });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  };

  findUserByRefreshToken = async (refreshToken: string) => {
    try {
      return await this.userModel.findOne({ refreshToken }).populate({
        path: 'role',
        select: {
          name: 1,
        },
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  };
}
