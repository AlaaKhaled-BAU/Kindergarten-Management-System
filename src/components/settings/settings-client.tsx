"use client";

import { errorMessage } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateKindergartenInfo, changeAdminPassword, updateSyncConfig, type KindergartenInfo, type SyncConfig } from "@/app/actions/settings-actions";
import { startNewAcademicYear } from "@/app/actions/academic-year-actions";
import { nextAcademicYear } from "@/lib/academic-year";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

export function SettingsClient({
  info,
  currentAcademicYear,
  syncConfig,
}: {
  info: KindergartenInfo;
  currentAcademicYear: string;
  syncConfig: SyncConfig;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [pwPending, setPwPending] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const [yearPending, setYearPending] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState(currentAcademicYear);

  const [syncPending, setSyncPending] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSaved, setSyncSaved] = useState(false);

  async function handleStartNewYear() {
    setYearError(null);
    setYearPending(true);
    try {
      const next = await startNewAcademicYear();
      setActiveYear(next);
      router.refresh();
    } catch (err) {
      setYearError(errorMessage(err));
    } finally {
      setYearPending(false);
    }
  }

  async function handleInfoSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      await updateKindergartenInfo({
        kindergartenName: formData.get("kindergartenName") as string,
        kindergartenAddress: formData.get("kindergartenAddress") as string,
        kindergartenPhone: formData.get("kindergartenPhone") as string,
        kindergartenEmail: formData.get("kindergartenEmail") as string,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function handleSyncSubmit(formData: FormData) {
    setSyncError(null);
    setSyncSaved(false);
    setSyncPending(true);
    try {
      await updateSyncConfig({
        workerUrl: formData.get("workerUrl") as string,
        token: formData.get("token") as string,
      });
      setSyncSaved(true);
    } catch (err) {
      setSyncError(errorMessage(err));
    } finally {
      setSyncPending(false);
    }
  }

  async function handlePasswordSubmit(formData: FormData) {
    setPwError(null);
    setPwSaved(false);
    setPwPending(true);
    try {
      const newPassword = formData.get("newPassword") as string;
      const confirmPassword = formData.get("confirmPassword") as string;
      if (newPassword !== confirmPassword) {
        throw new Error("كلمتا المرور الجديدتان غير متطابقتين");
      }
      await changeAdminPassword(formData.get("currentPassword") as string, newPassword);
      setPwSaved(true);
      (document.getElementById("password-form") as HTMLFormElement)?.reset();
    } catch (err) {
      setPwError(errorMessage(err));
    } finally {
      setPwPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>السنة الدراسية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">السنة الدراسية الحالية</p>
            <p className="text-2xl font-bold">{activeYear}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            هذا هو ما تفترضه القوائم الجديدة (الطلاب، الرسوم، الترقية) كسنة حالية. يمكن اختيار أي سنة أخرى يدوياً في كل قائمة عند الحاجة.
          </p>
          {yearError && <p className="text-sm text-destructive" role="alert">{yearError}</p>}
          <Button
            variant="outline"
            disabled={yearPending}
            onClick={() => {
              if (window.confirm(`سيتم بدء سنة دراسية جديدة (${nextAcademicYear(activeYear)}). هل أنت متأكد؟`)) {
                handleStartNewYear();
              }
            }}
          >
            <ArrowRight className="me-2 size-4" />
            {yearPending ? "جارٍ التنفيذ..." : `بدء سنة دراسية جديدة (${nextAcademicYear(activeYear)})`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>بيانات الروضة</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleInfoSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kindergartenName">اسم الروضة *</Label>
              <Input id="kindergartenName" name="kindergartenName" defaultValue={info.kindergartenName} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kindergartenAddress">العنوان</Label>
              <Input id="kindergartenAddress" name="kindergartenAddress" defaultValue={info.kindergartenAddress} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kindergartenPhone">الهاتف</Label>
                <Input id="kindergartenPhone" name="kindergartenPhone" type="tel" defaultValue={info.kindergartenPhone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kindergartenEmail">البريد الإلكتروني</Label>
                <Input id="kindergartenEmail" name="kindergartenEmail" type="email" defaultValue={info.kindergartenEmail} />
              </div>
            </div>
            {saved && <p className="text-sm text-success">تم الحفظ بنجاح</p>}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مزامنة قاعدة البيانات بين الأجهزة</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSyncSubmit} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              اتركهما فارغين لتعطيل المزامنة. عند الإغلاق يرفع الجهاز نسخة قاعدة البيانات، وعند الفتح يسحب أحدث نسخة. يجب استخدام نفس الرابط والرمز على كل الأجهزة.
            </p>
            <div className="space-y-2">
              <Label htmlFor="workerUrl">رابط خادم المزامنة</Label>
              <Input id="workerUrl" name="workerUrl" type="url" defaultValue={syncConfig.workerUrl} placeholder="https://kindergarten-sync-worker.example.workers.dev" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">رمز المزامنة السري</Label>
              <Input id="token" name="token" type="password" defaultValue={syncConfig.token} />
            </div>
            {syncSaved && <p className="text-sm text-success">تم الحفظ بنجاح</p>}
            {syncError && <p className="text-sm text-destructive" role="alert">{syncError}</p>}
            <Button type="submit" disabled={syncPending}>
              {syncPending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تغيير كلمة مرور المسؤول</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="password-form" action={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <Input id="newPassword" name="newPassword" type="password" required minLength={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={4} />
            </div>
            {pwSaved && <p className="text-sm text-success">تم تغيير كلمة المرور بنجاح</p>}
            {pwError && <p className="text-sm text-destructive" role="alert">{pwError}</p>}
            <Button type="submit" disabled={pwPending}>
              {pwPending ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
