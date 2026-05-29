import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  updateRetreatByPhone,
  deleteRetreatByPhone,
  addRetreatGroupMember,
  adminAddRetreatGroupMember,
  fetchRetreatGroupById,
  lookupRetreatGroupByPhone,
} from "@/lib/retreat.functions";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

export type GroupMember = {
  id: string;
  confirmation_no: string | null;
  paid?: boolean | null;
  church: string | null;
  chinese_name: string;
  last_name: string | null;
  first_name: string | null;
  gender: string | null;
  cell: string | null;
  email: string | null;
  program: string | null;
  topic: string | null;
  bed: string | null;
  can_pickup: number | null;
  need_pickup: number | null;
  user_notes: string | null;
  created_at?: string;
};

const CHURCHES = ["hoc1", "hoc2", "hoc3", "hoc4", "hoc5", "hoc6", "hoc7"];
const PROGRAMS = [
  { v: "M", label: "M — 中文" },
  { v: "E", label: "E — 英文" },
  { v: "N", label: "N — 9~11 岁" },
  { v: "S", label: "S — 7~8 岁" },
  { v: "F", label: "F — 5~6 岁" },
  { v: "T", label: "T — 4 岁" },
  { v: "R", label: "R — 3 岁" },
  { v: "B", label: "B — 0~2 岁" },
];
const TOPICS = [
  { v: "1", label: "1 - 迎接老年时代" },
  { v: "2", label: "2 - 婚姻成长 / 陪孩子" },
  { v: "3", label: "3 - 走过悲伤与忧郁" },
  { v: "4", label: "4 - AI 热潮下做理财好管家" },
];

function emptyPerson(): Partial<GroupMember> {
  return {
    chinese_name: "",
    last_name: "",
    first_name: "",
    gender: "",
    cell: "",
    email: "",
    program: "",
    topic: "",
    bed: "",
    user_notes: "",
  };
}

function groupHeader(members: GroupMember[]) {
  const first = members[0];
  const conf = first?.confirmation_no ?? "";
  const parts = conf.split("-");
  const formNo = parts.length === 3 ? `${parts[0]}-${parts[1]}` : conf;
  const phone = members.find((m) => m.cell)?.cell ?? "—";
  const date = first?.created_at
    ? new Date(first.created_at).toLocaleDateString("zh-CN")
    : "—";
  return { formNo, phone, date };
}

type Props = {
  open: boolean;
  onClose: () => void;
  members: GroupMember[];
  /** Phone used to verify edits; if omitted, treated as admin mode. */
  phone?: string;
  /** Re-fetch source data (called after each successful change). */
  onChanged: (nextMembers: GroupMember[]) => void;
};

export function RetreatGroupEditor({
  open,
  onClose,
  members,
  phone,
  onChanged,
}: Props) {
  const isAdmin = !phone;
  const [expandedId, setExpandedId] = useState<string | null>(
    members[0]?.id ?? null,
  );
  const [drafts, setDrafts] = useState<Record<string, GroupMember>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GroupMember | null>(null);
  const [pendingDeleteAll, setPendingDeleteAll] = useState<GroupMember | null>(
    null,
  );
  const [addingOpen, setAddingOpen] = useState(false);
  const [newPerson, setNewPerson] = useState<Partial<GroupMember>>(
    emptyPerson(),
  );
  const [adding, setAdding] = useState(false);

  const update = useServerFn(updateRetreatByPhone);
  const remove = useServerFn(deleteRetreatByPhone);
  const addByPhone = useServerFn(addRetreatGroupMember);
  const addByAdmin = useServerFn(adminAddRetreatGroupMember);
  const fetchById = useServerFn(fetchRetreatGroupById);
  const lookupByPhone = useServerFn(lookupRetreatGroupByPhone);

  const { formNo, phone: contactPhone, date } = groupHeader(members);
  const refId = members[0]?.id;

  function draftFor(m: GroupMember): GroupMember {
    return drafts[m.id] ?? m;
  }
  function setDraft(m: GroupMember, patch: Partial<GroupMember>) {
    setDrafts((d) => ({ ...d, [m.id]: { ...draftFor(m), ...patch } }));
  }

  async function refreshGroup(): Promise<GroupMember[]> {
    if (!refId) return members;
    try {
      if (isAdmin) {
        const r = await fetchById({ data: { id: refId } });
        return r.members as GroupMember[];
      }
      const r = await lookupByPhone({ data: { phone: phone!.trim() } });
      // Find the group containing refId; fall back to first group
      const g =
        r.groups.find((g: any) => g.members.some((m: any) => m.id === refId)) ??
        r.groups[0];
      return ((g?.members ?? []) as GroupMember[]);
    } catch {
      return members;
    }
  }

  async function saveMember(m: GroupMember) {
    const d = draftFor(m);
    if (!d.chinese_name.trim()) {
      toast.error("中文姓名不能为空");
      return;
    }
    setSavingId(m.id);
    try {
      if (isAdmin) {
        const { error } = await supabase
          .from("retreat_registrations")
          .update({
            church: d.church,
            chinese_name: d.chinese_name,
            last_name: d.last_name,
            first_name: d.first_name,
            gender: d.gender,
            cell: d.cell,
            email: d.email,
            program: d.program,
            topic: d.topic,
            bed: d.bed,
            can_pickup: d.can_pickup,
            need_pickup: d.need_pickup,
            user_notes: d.user_notes,
            paid: d.paid ?? false,
          })
          .eq("id", m.id);
        if (error) throw new Error(error.message);
      } else {
        await update({
          data: {
            id: m.id,
            phone: phone!.trim(),
            patch: {
              church: d.church,
              chinese_name: d.chinese_name,
              last_name: d.last_name,
              first_name: d.first_name,
              gender: d.gender,
              cell: d.cell,
              email: d.email,
              program: d.program,
              topic: d.topic,
              bed: d.bed,
              can_pickup: d.can_pickup,
              need_pickup: d.need_pickup,
              user_notes: d.user_notes,
            },
          },
        });
      }
      toast.success("修改已保存");
      const next = await refreshGroup();
      onChanged(next);
      setDrafts((cur) => {
        const { [m.id]: _omit, ...rest } = cur;
        return rest;
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteMember(m: GroupMember, alsoWholeForm = false) {
    try {
      if (isAdmin) {
        if (alsoWholeForm) {
          const ids = members.map((x) => x.id);
          const { error } = await supabase
            .from("retreat_registrations")
            .delete()
            .in("id", ids);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase
            .from("retreat_registrations")
            .delete()
            .eq("id", m.id);
          if (error) throw new Error(error.message);
        }
      } else {
        if (alsoWholeForm) {
          for (const x of members) {
            await remove({ data: { id: x.id, phone: phone!.trim() } });
          }
        } else {
          await remove({ data: { id: m.id, phone: phone!.trim() } });
        }
      }
      toast.success("已删除");
      if (alsoWholeForm) {
        onChanged([]);
        onClose();
        return;
      }
      const next = await refreshGroup();
      if (next.length === 0) {
        onChanged([]);
        onClose();
      } else {
        onChanged(next);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addMember() {
    if (!refId) return;
    if (!newPerson.chinese_name?.trim()) {
      toast.error("请填写中文姓名");
      return;
    }
    setAdding(true);
    try {
      const person = {
        chinese_name: newPerson.chinese_name!.trim(),
        last_name: newPerson.last_name?.trim() || null,
        first_name: newPerson.first_name?.trim() || null,
        gender: newPerson.gender || null,
        cell: newPerson.cell?.trim() || null,
        email: newPerson.email?.trim() || null,
        program: newPerson.program || null,
        topic: newPerson.topic || null,
        bed: newPerson.bed || null,
        user_notes: newPerson.user_notes?.trim() || null,
      };
      if (isAdmin) {
        await addByAdmin({ data: { groupRefId: refId, person } });
      } else {
        await addByPhone({
          data: { groupRefId: refId, phone: phone!.trim(), person },
        });
      }
      toast.success("已添加新成员");
      setNewPerson(emptyPerson());
      setAddingOpen(false);
      const next = await refreshGroup();
      onChanged(next);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              编辑登记单 · {formNo}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                共 {members.length} 位
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-xl border border-border/50 bg-muted/30 p-3 sm:p-4 text-sm grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <div><span className="text-muted-foreground">登记单编号</span><div className="font-medium">{formNo || "—"}</div></div>
            <div><span className="text-muted-foreground">联系电话</span><div className="font-medium">{contactPhone}</div></div>
            <div><span className="text-muted-foreground">注册日期</span><div className="font-medium">{date}</div></div>
          </div>

          <div className="space-y-3">
            {members.map((m, idx) => {
              const d = draftFor(m);
              const expanded = expandedId === m.id;
              return (
                <div key={m.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : m.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {idx + 1}. {m.chinese_name}
                        {m.gender ? ` (${m.gender})` : ""}
                        {m.program ? ` · ${m.program}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.confirmation_no ?? "—"} · {m.cell ?? "无电话"}
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {expanded && (
                    <div className="border-t border-border/50 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label>中文姓名 *</Label>
                          <Input className="mt-1" value={d.chinese_name} onChange={(e) => setDraft(m, { chinese_name: e.target.value })} />
                        </div>
                        <div>
                          <Label>性别</Label>
                          <select value={d.gender ?? ""} onChange={(e) => setDraft(m, { gender: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                            <option value="">—</option>
                            <option value="M">M (男)</option>
                            <option value="F">F (女)</option>
                          </select>
                        </div>
                        <div>
                          <Label>Last Name</Label>
                          <Input className="mt-1" value={d.last_name ?? ""} onChange={(e) => setDraft(m, { last_name: e.target.value })} />
                        </div>
                        <div>
                          <Label>First Name</Label>
                          <Input className="mt-1" value={d.first_name ?? ""} onChange={(e) => setDraft(m, { first_name: e.target.value })} />
                        </div>
                        <div>
                          <Label>手机</Label>
                          <Input className="mt-1" value={d.cell ?? ""} onChange={(e) => setDraft(m, { cell: e.target.value })} />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input className="mt-1" type="email" value={d.email ?? ""} onChange={(e) => setDraft(m, { email: e.target.value })} />
                        </div>
                        <div>
                          <Label>基督之家</Label>
                          <select value={d.church ?? ""} onChange={(e) => setDraft(m, { church: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                            <option value="">—</option>
                            {CHURCHES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label>Program</Label>
                          <select value={d.program ?? ""} onChange={(e) => setDraft(m, { program: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                            <option value="">—</option>{PROGRAMS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label>Topic (週六专题)</Label>
                          <select value={d.topic ?? ""} onChange={(e) => setDraft(m, { topic: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                            <option value="">—</option>{TOPICS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label>Bed (4-11 岁)</Label>
                          <select value={d.bed ?? ""} onChange={(e) => setDraft(m, { bed: e.target.value || null })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                            <option value="">—</option>
                            <option value="yes">占床位 ($180)</option>
                            <option value="no">不占床位 ($110)</option>
                          </select>
                        </div>
                        {idx === 0 && (
                          <>
                            <div>
                              <Label>可接送 (位)</Label>
                              <Input type="number" min={0} className="mt-1" value={d.can_pickup ?? ""} onChange={(e) => setDraft(m, { can_pickup: e.target.value === "" ? null : parseInt(e.target.value, 10) })} />
                            </div>
                            <div>
                              <Label>需接送 (位)</Label>
                              <Input type="number" min={0} className="mt-1" value={d.need_pickup ?? ""} onChange={(e) => setDraft(m, { need_pickup: e.target.value === "" ? null : parseInt(e.target.value, 10) })} />
                            </div>
                          </>
                        )}
                        {isAdmin && (
                          <div>
                            <Label>已付费</Label>
                            <select value={d.paid ? "1" : "0"} onChange={(e) => setDraft(m, { paid: e.target.value === "1" })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                              <option value="0">未付</option>
                              <option value="1">已付</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div>
                        <Label>备注</Label>
                        <Textarea rows={2} className="mt-1" value={d.user_notes ?? ""} onChange={(e) => setDraft(m, { user_notes: e.target.value })} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            if (members.length === 1) setPendingDeleteAll(m);
                            else setPendingDelete(m);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          删除此人员
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="ml-auto"
                          disabled={savingId === m.id}
                          onClick={() => saveMember(m)}
                        >
                          {savingId === m.id ? "保存中…" : "保存修改"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddingOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              添加人员
            </Button>
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add-member dialog */}
      <Dialog open={addingOpen} onOpenChange={setAddingOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加新成员 · {formNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>中文姓名 *</Label>
                <Input className="mt-1" value={newPerson.chinese_name ?? ""} onChange={(e) => setNewPerson({ ...newPerson, chinese_name: e.target.value })} />
              </div>
              <div>
                <Label>性别</Label>
                <select value={newPerson.gender ?? ""} onChange={(e) => setNewPerson({ ...newPerson, gender: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">—</option><option value="M">M</option><option value="F">F</option>
                </select>
              </div>
              <div><Label>Last Name</Label><Input className="mt-1" value={newPerson.last_name ?? ""} onChange={(e) => setNewPerson({ ...newPerson, last_name: e.target.value })} /></div>
              <div><Label>First Name</Label><Input className="mt-1" value={newPerson.first_name ?? ""} onChange={(e) => setNewPerson({ ...newPerson, first_name: e.target.value })} /></div>
              <div><Label>手机</Label><Input className="mt-1" value={newPerson.cell ?? ""} onChange={(e) => setNewPerson({ ...newPerson, cell: e.target.value })} /></div>
              <div><Label>Email</Label><Input className="mt-1" value={newPerson.email ?? ""} onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })} /></div>
              <div>
                <Label>Program</Label>
                <select value={newPerson.program ?? ""} onChange={(e) => setNewPerson({ ...newPerson, program: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">—</option>{PROGRAMS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Bed</Label>
                <select value={newPerson.bed ?? ""} onChange={(e) => setNewPerson({ ...newPerson, bed: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">—</option><option value="yes">占床位</option><option value="no">不占床位</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Topic</Label>
              <select value={newPerson.topic ?? ""} onChange={(e) => setNewPerson({ ...newPerson, topic: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">—</option>{TOPICS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>备注</Label>
              <Textarea rows={2} className="mt-1" value={newPerson.user_notes ?? ""} onChange={(e) => setNewPerson({ ...newPerson, user_notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddingOpen(false)}>取消</Button>
              <Button onClick={addMember} disabled={adding}>{adding ? "添加中…" : "添加"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete single member confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除此报名人员吗？</AlertDialogTitle>
            <AlertDialogDescription>
              将仅删除「{pendingDelete?.chinese_name}」，不影响同一登记单中其他成员。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const m = pendingDelete;
                setPendingDelete(null);
                if (m) await deleteMember(m, false);
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Last-member confirmation: prompts to delete whole form */}
      <AlertDialog open={!!pendingDeleteAll} onOpenChange={(o) => !o && setPendingDeleteAll(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>这是该登记单最后一位报名人员</AlertDialogTitle>
            <AlertDialogDescription>
              是否删除整张登记单？此操作无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const m = pendingDeleteAll;
                setPendingDeleteAll(null);
                if (m) await deleteMember(m, true);
              }}
            >
              删除整张登记单
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}