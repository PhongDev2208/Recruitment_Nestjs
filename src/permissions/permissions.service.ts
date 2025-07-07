import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { IUser } from 'src/users/users.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Permission, PermissionDocument } from './schemas/permission.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import aqp from 'api-query-params';
import mongoose from 'mongoose';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission.name)
    private permissionModel: SoftDeleteModel<PermissionDocument>,
  ) {}
  async create(createPermissionDto: CreatePermissionDto, user: IUser) {
    try {
      const { name, apiPath, method, module } = createPermissionDto;
      const permissionExist = await this.permissionModel.findOne({
        apiPath: apiPath,
        method: method,
      });
      if (permissionExist) {
        throw new BadRequestException(
          `Permission with apiPath=${permissionExist.apiPath}, method=${permissionExist.method} already exists`,
        );
      }

      const permission = await this.permissionModel.create({
        name,
        apiPath,
        method,
        module,
        createdBy: {
          _id: user._id,
          email: user.email,
        },
      });
      return {
        _id: permission._id,
        createdAt: permission.createdAt,
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

      const totalItems = (await this.permissionModel.find(filter)).length;
      const totalPages = Math.ceil(totalItems / defaultLimit);

      const result = await this.permissionModel
        .find(filter)
        .skip(offset)
        .limit(defaultLimit)
        .sort(sort as any)
        .populate(population)
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
        throw new BadRequestException(`Permission with id=${id} not found`);
      }
      return await this.permissionModel.findById({ _id: id });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
    user: IUser,
  ) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Permission with id=${id} not found`);
      }
      const { name, apiPath, method, module } = updatePermissionDto;
      return await this.permissionModel.updateOne(
        { _id: id },
        {
          name,
          apiPath,
          method,
          module,
          updatedBy: {
            _id: user._id,
            email: user.email,
          },
        },
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
    return `This action updates a #${id} permission`;
  }

  async remove(id: string, user: IUser) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Permission with id=${id} not found`);
      }
      await this.permissionModel.updateOne(
        { _id: id },
        {
          deletedBy: {
            _id: user._id,
            email: user.email,
          },
        },
      );
      return await this.permissionModel.softDelete({ _id: id });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
