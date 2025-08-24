import { z } from 'zod';
import { Workspace } from '../types';

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(100, '名前は100文字以内で入力してください'),
  description: z.string().optional(),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(100, '名前は100文字以内で入力してください').optional(),
  description: z.string().optional(),
});

export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceSchema>;

export class WorkspaceModel {
  static create(data: CreateWorkspaceRequest & { ownerId: string }): Omit<Workspace, 'id'> {
    const now = new Date();
    return {
      name: data.name,
      description: data.description,
      ownerId: data.ownerId,
      createdAt: now,
      updatedAt: now,
    };
  }

  static update(existing: Workspace, data: UpdateWorkspaceRequest): Workspace {
    return {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
  }
}