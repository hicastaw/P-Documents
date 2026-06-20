/**
 * controller.ts — HTTP layer for the forum module.
 * Maps to the thesis ForumController control class (Chuong3_ok.md 3.1.3,
 * modules f1 "Tạo chủ đề mới" and f2 "Bình luận và phản hồi").
 */
import type { Request, Response } from "express";
import { z } from "zod";
import * as service from "../services/forum.service";

export async function listThreads(req: Request, res: Response) {
  const q = z.string().optional().parse(req.query.q);
  const threads = await service.listThreads(q);
  return res.json({ threads });
}

const CreateThreadBodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
});

export async function createThread(req: Request, res: Response) {
  const body = CreateThreadBodySchema.parse(req.body);
  const thread = await service.createThread(body.title, body.body, req.auth!.userId);
  return res.status(201).json({ thread });
}

export async function getThread(req: Request, res: Response) {
  const threadId = z.string().uuid().parse(req.params.id);
  const data = await service.getThreadWithPosts(threadId);
  if (!data) return res.status(404).json({ error: "not_found" });
  return res.json(data);
}

const AddPostBodySchema = z.object({
  body: z.string().min(1).max(5000),
  parentId: z.string().uuid().optional(),
});

export async function postComment(req: Request, res: Response) {
  const threadId = z.string().uuid().parse(req.params.id);
  const body = AddPostBodySchema.parse(req.body);
  const post = await service.addPost({
    threadId,
    authorId: req.auth!.userId,
    body: body.body,
    parentId: body.parentId,
    io: req.app.get("io"),
  });
  if (!post) return res.status(404).json({ error: "thread_not_found" });
  return res.status(201).json({ post });
}

export async function deletePost(req: Request, res: Response) {
  const postId = z.string().uuid().parse(req.params.id);
  const ok = await service.deletePost(postId, req.auth!.userId);
  if (!ok) return res.status(404).json({ error: "not_found_or_not_owner" });
  return res.json({ ok: true });
}
