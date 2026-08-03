import { PaginationInfo } from 'src/common/types/type';
import { MinimalUserSelect, UserSelect } from '../queries';

export interface GetAllUserResponse {
  users: UserSelect[];
  pagination: PaginationInfo;
}

/**
 * What the invite picker receives. Deliberately MinimalUserSelect rather than
 * UserSelect — `hasNotifications` and `createdAt` are internal fields and have
 * no business in another user's client.
 */
export interface ListUsersResponse {
  users: MinimalUserSelect[];
  pagination: PaginationInfo;
}
