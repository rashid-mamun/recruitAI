import mongoose, { Schema } from 'mongoose';

const CompetencySchema = new Schema(
    {
        id: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, default: '' },
        weight: { type: Number, min: 1, max: 100, required: true },
    },
    { _id: false }
);
const ScorecardTemplateSchema = new Schema(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        name: { type: String, required: true, trim: true, maxlength: 160 },
        roleFamily: { type: String, required: true, trim: true, maxlength: 160 },
        competencies: { type: [CompetencySchema], required: true },
        defaultWeights: { type: Map, of: Number, default: {} },
        passingScore: { type: Number, min: 0, max: 100, default: 70 },
        createdBy: { type: String, required: true },
    },
    { timestamps: true }
);
ScorecardTemplateSchema.index({ organizationId: 1, name: 1 }, { unique: true });
export const ScorecardTemplate = mongoose.model('ScorecardTemplate', ScorecardTemplateSchema);
