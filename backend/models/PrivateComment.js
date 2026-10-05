const mongoose = require('mongoose');

/**
 * One message in the private conversation between a trainee and their
 * officers about a single module/activity (Google Classroom-style "private
 * comments"). The thread is keyed by (moduleId, studentId): only that trainee
 * and the staff who manage them can read or post in it. Stays open after the
 * due date — that's how a trainee raises a concern about Missing work.
 */
const privateCommentSchema = new mongoose.Schema(
  {
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
    /** User document of the trainee whose thread this is. */
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Who wrote this message — the trainee or a staff member. */
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

privateCommentSchema.index({ moduleId: 1, studentId: 1, createdAt: 1 });

module.exports = mongoose.model('PrivateComment', privateCommentSchema);
