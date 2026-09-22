-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "hall_ticket" VARCHAR(20) NOT NULL,
    "student_name" VARCHAR(255) NOT NULL,
    "father_name" VARCHAR(255),
    "mother_name" VARCHAR(255),
    "program" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "semester_name" VARCHAR(100) NOT NULL,
    "exam_month_year" VARCHAR(50) NOT NULL,
    "sgpa" DECIMAL(5,2),
    "overall_result" VARCHAR(50),
    "source_run_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" SERIAL NOT NULL,
    "course_code" VARCHAR(50) NOT NULL,
    "course_title" TEXT NOT NULL,
    "credits" INTEGER,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semester_results" (
    "id" SERIAL NOT NULL,
    "semester_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "grade" VARCHAR(10),
    "subject_result" VARCHAR(20),
    "month_year" VARCHAR(50),

    CONSTRAINT "semester_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_entries" (
    "key" VARCHAR(255) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "rate_limit_entries_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_hall_ticket_key" ON "students"("hall_ticket");

-- CreateIndex
CREATE INDEX "students_program_idx" ON "students"("program");

-- CreateIndex
CREATE INDEX "semesters_student_id_idx" ON "semesters"("student_id");

-- CreateIndex
CREATE INDEX "semesters_semester_name_idx" ON "semesters"("semester_name");

-- CreateIndex
CREATE INDEX "semesters_exam_month_year_idx" ON "semesters"("exam_month_year");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_student_id_semester_name_exam_month_year_key" ON "semesters"("student_id", "semester_name", "exam_month_year");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_course_code_key" ON "subjects"("course_code");

-- CreateIndex
CREATE INDEX "semester_results_subject_id_idx" ON "semester_results"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "semester_results_semester_id_subject_id_key" ON "semester_results"("semester_id", "subject_id");

-- CreateIndex
CREATE INDEX "rate_limit_entries_windowStart_idx" ON "rate_limit_entries"("windowStart");

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_results" ADD CONSTRAINT "semester_results_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_results" ADD CONSTRAINT "semester_results_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
