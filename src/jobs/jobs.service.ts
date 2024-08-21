import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { IUser } from 'src/users/users.interface';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Job, JobDocument } from './schemas/job.schema';
import dayjs from 'dayjs';
import aqp from 'api-query-params';
import mongoose from 'mongoose';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name)
    private jobModel: SoftDeleteModel<JobDocument>,
  ) {}
  async create(createJobDto: CreateJobDto, user: IUser) {
    try {
      if (dayjs().isAfter(dayjs(createJobDto.endDate))) {
        throw new BadRequestException(
          'End date must be greater than the current date',
        );
      }
      const job = await this.jobModel.create({
        ...createJobDto,
        createdBy: {
          _id: user._id,
          email: user.email,
        },
      });
      return {
        _id: job._id,
        createAt: job.createdAt,
      };
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

      const totalItems = await this.jobModel.count(filter);
      const totalPages = Math.ceil(totalItems / defaultLimit);

      const result = await this.jobModel
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

  findOne(id: string) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new NotFoundException(`Job with id ${id} not found`);
      }

      return this.jobModel.findOne({ _id: id });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(id: string, updateJobDto: UpdateJobDto, user: IUser) {
    try {
      return await this.jobModel.updateOne(
        {
          _id: id,
        },
        {
          ...updateJobDto,
          updatedBy: {
            _id: user._id,
            email: user.email,
          },
        },
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async remove(id: string, user: IUser) {
    try {
      await this.jobModel.updateOne(
        {
          _id: id,
        },
        {
          deletedBy: {
            _id: user._id,
            email: user.email,
          },
        },
      );
      return await this.jobModel.softDelete({
        _id: id,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
