import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { IUser } from 'src/users/users.interface';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Subscriber, SubscriberDocument } from './schemas/subscriber.schema';
import aqp from 'api-query-params';
import mongoose from 'mongoose';

@Injectable()
export class SubscribersService {
  constructor(
    @InjectModel(Subscriber.name)
    private subscriberModel: SoftDeleteModel<SubscriberDocument>,
  ) {}
  async create(createSubscriberDto: CreateSubscriberDto, user: IUser) {
    try {
      const isExist = this.subscriberModel.findOne({
        email: createSubscriberDto.email,
      });
      if (isExist) {
        throw new BadRequestException(
          `Email ${createSubscriberDto.email} already exists`,
        );
      }

      const newSubscriber = await this.subscriberModel.create({
        ...createSubscriberDto,
        createdBy: {
          id: user._id,
          email: user.email,
        },
      });

      return {
        _id: newSubscriber._id,
        createdAt: newSubscriber.createdAt,
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

      const totalItems = (await this.subscriberModel.find(filter)).length;
      const totalPages = Math.ceil(totalItems / defaultLimit);

      const result = await this.subscriberModel
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
        throw new BadRequestException(`Subscriber with id ${id} not found`);
      }

      return this.subscriberModel.findOne({ _id: id });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(updateSubscriberDto: UpdateSubscriberDto, user: IUser) {
    try {
      return await this.subscriberModel.updateOne(
        {
          email: updateSubscriberDto.email,
        },
        {
          ...updateSubscriberDto,
          updatedBy: {
            _id: user._id,
            email: user.email,
          },
        },
        {
          upsert: true,
        },
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async remove(id: string, user: IUser) {
    try {
      await this.subscriberModel.updateOne(
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
      return await this.subscriberModel.softDelete({
        _id: id,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getSkills(user: IUser) {
    try {
      return await this.subscriberModel.findOne(
        {
          email: user.email,
        },
        {
          skills: 1,
        },
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
