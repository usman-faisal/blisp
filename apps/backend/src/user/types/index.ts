import { PaginationInfo } from 'src/common/types/type';
import { UserSelect } from '../queries';

export interface GetAllUserResponse {
  users: UserSelect[];
  pagination: PaginationInfo;
}
