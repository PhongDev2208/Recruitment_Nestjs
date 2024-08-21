import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role, RoleDocument } from './schemas/role.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/users/users.interface';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import aqp from 'api-query-params';
import { ConfigService } from '@nestjs/config';
import { ADMIN_ROLE } from 'src/constans/sample';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private roleModel: SoftDeleteModel<RoleDocument>,
    private configService: ConfigService,
  ) {}
  async create(createRoleDto: CreateRoleDto, user: IUser) {
    try {
      const isExist = await this.roleModel.findOne({
        name: createRoleDto.name,
      });
      if (isExist) {
        throw new BadRequestException(
          `Role with name=${isExist.name} already exists`,
        );
      }
      const newRole = await this.roleModel.create({
        ...createRoleDto,
        createdBy: {
          id: user._id,
          email: user.email,
        },
      });
      return {
        _id: newRole._id,
        createdAt: newRole.createdAt,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    try {
      const { filter, sort, projection, population } = aqp(qs);
      delete filter.current;
      delete filter.pageSize;

      const offset = (currentPage - 1) * limit;
      const defaultLimit = limit ? limit : 10;

      const totalItems = await this.roleModel.count(filter);
      const totalPages = Math.ceil(totalItems / defaultLimit);

      const result = await this.roleModel
        .find(filter)
        .skip(offset)
        .limit(defaultLimit)
        .sort(sort as any)
        .populate(population)
        .select(projection as any)
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
        throw new BadRequestException(`Invalid role with id=${id}`);
      }
      return (await this.roleModel.findById(id)).populate({
        path: 'permissions',
        select: { name: 1, _id: 1, apiPath: 1, method: 1, module: 1 },
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, user: IUser) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid role with id=${id}`);
      }
      // const isExist = await this.roleModel.findOne({
      //   name: updateRoleDto.name,
      // });
      // if (isExist) {
      //   throw new BadRequestException(
      //     `Role with name=${isExist.name} already exists`,
      //   );
      // }
      return await this.roleModel.updateOne(
        { _id: id },
        { ...updateRoleDto, updatedBy: { id: user._id, email: user.email } },
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async remove(id: string, user: IUser) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid role with id=${id}`);
      }

      const foundRole = await this.roleModel.findById(id);
      if (foundRole.name == ADMIN_ROLE) {
        throw new BadRequestException(
          `Cannot delete role with name=${foundRole.name}`,
        );
      }

      await this.roleModel.updateOne(
        { _id: id },
        {
          deletedBy: {
            id: user._id,
            email: user.email,
          },
        },
      );
      return await this.roleModel.softDelete({
        _id: id,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
