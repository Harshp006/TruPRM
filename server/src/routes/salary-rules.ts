import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { RuleStatus, RuleCalculationType, SalaryRuleCategory } from '@prisma/client';

const router = Router();

router.use(authenticate);

// GET /api/salary-rules?structureId=:structureId
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { structureId } = req.query;

    const whereClause: any = {};
    if (structureId) {
      whereClause.salaryStructureId = String(structureId);
    }

    const rules = await prisma.salaryRule.findMany({
      where: whereClause,
      orderBy: [{ sequence: 'asc' }, { code: 'asc' }],
    });

    res.json(rules);
  } catch (err) {
    console.error('Fetch salary rules error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/salary-rules
router.post(
  '/',
  authorize('HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        salaryStructureId,
        name,
        code,
        category,
        sequence,
        calculationType,
        fixedAmount,
        percentage,
        baseCode,
        formula,
        condition,
        conditionType,
        conditionValue,
        roundingRule,
        status,
      } = req.body;

      if (!salaryStructureId || !name || !code) {
        res.status(400).json({
          message: 'salaryStructureId, name, and code are required',
        });
        return;
      }

      const structIdStr = String(salaryStructureId);
      const codeStr = String(code);

      const structure = await prisma.salaryStructure.findUnique({
        where: { id: structIdStr },
      });

      if (!structure) {
        res.status(404).json({ message: 'Salary structure not found' });
        return;
      }

      const existingCode = await prisma.salaryRule.findUnique({
        where: {
          salaryStructureId_code: {
            salaryStructureId: structIdStr,
            code: codeStr,
          },
        },
      });

      if (existingCode) {
        res.status(400).json({
          message: `Rule code '${codeStr}' already exists in this salary structure`,
        });
        return;
      }

      const rule = await prisma.salaryRule.create({
        data: {
          salaryStructureId: structIdStr,
          name: String(name),
          code: codeStr,
          category: (category as SalaryRuleCategory) || SalaryRuleCategory.EARNING,
          sequence: sequence !== undefined ? Number(sequence) : 0,
          calculationType: (calculationType as RuleCalculationType) || RuleCalculationType.FIXED_AMOUNT,
          fixedAmount: fixedAmount !== undefined ? fixedAmount : null,
          amountFixed: fixedAmount !== undefined ? fixedAmount : null,
          percentage: percentage !== undefined ? percentage : null,
          amountPercentage: percentage !== undefined ? percentage : null,
          baseCode: baseCode ? String(baseCode) : null,
          formula: formula ? String(formula) : null,
          condition: condition ? String(condition) : null,
          conditionType: conditionType ? String(conditionType) : null,
          conditionValue: conditionValue !== undefined && conditionValue !== null ? Number(conditionValue) : null,
          roundingRule: roundingRule ? String(roundingRule) : null,
          status: (status as RuleStatus) || RuleStatus.ACTIVE,
        },
      });

      res.status(201).json(rule);
    } catch (err) {
      console.error('Create salary rule error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PUT /api/salary-rules/:id
router.put(
  '/:id',
  authorize('HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const {
        name,
        code,
        category,
        sequence,
        calculationType,
        fixedAmount,
        percentage,
        baseCode,
        formula,
        condition,
        conditionType,
        conditionValue,
        roundingRule,
        status,
      } = req.body;

      const existingRule = await prisma.salaryRule.findUnique({
        where: { id },
      });

      if (!existingRule) {
        res.status(404).json({ message: 'Salary rule not found' });
        return;
      }

      const codeStr = code ? String(code) : undefined;
      if (codeStr && codeStr !== existingRule.code) {
        const codeCheck = await prisma.salaryRule.findUnique({
          where: {
            salaryStructureId_code: {
              salaryStructureId: existingRule.salaryStructureId,
              code: codeStr,
            },
          },
        });
        if (codeCheck) {
          res.status(400).json({
            message: `Rule code '${codeStr}' already exists in this salary structure`,
          });
          return;
        }
      }

      const updated = await prisma.salaryRule.update({
        where: { id },
        data: {
          ...(name && { name: String(name) }),
          ...(codeStr && { code: codeStr }),
          ...(category && { category: category as SalaryRuleCategory }),
          ...(sequence !== undefined && { sequence: Number(sequence) }),
          ...(calculationType && { calculationType: calculationType as RuleCalculationType }),
          ...(fixedAmount !== undefined && {
            fixedAmount: fixedAmount,
            amountFixed: fixedAmount,
          }),
          ...(percentage !== undefined && {
            percentage: percentage,
            amountPercentage: percentage,
          }),
          ...(baseCode !== undefined && { baseCode: baseCode ? String(baseCode) : null }),
          ...(formula !== undefined && { formula: formula ? String(formula) : null }),
          ...(condition !== undefined && { condition: condition ? String(condition) : null }),
          ...(conditionType !== undefined && { conditionType: conditionType ? String(conditionType) : null }),
          ...(conditionValue !== undefined && { conditionValue: conditionValue !== null ? Number(conditionValue) : null }),
          ...(roundingRule !== undefined && { roundingRule: roundingRule ? String(roundingRule) : null }),
          ...(status && { status: status as RuleStatus }),
        },
      });

      res.json(updated);
    } catch (err) {
      console.error('Update salary rule error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// DELETE /api/salary-rules/:id
// Deletes rule ONLY IF SAFE according to architecture. Prefer deactivation over deletion if used in history!
router.delete(
  '/:id',
  authorize('HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const existingRule = await prisma.salaryRule.findUnique({
        where: { id },
      });

      if (!existingRule) {
        res.status(404).json({ message: 'Salary rule not found' });
        return;
      }

      // Check if payslip lines exist using this rule's code and structure
      const usageInPayslips = await prisma.payslipLine.findFirst({
        where: {
          code: existingRule.code,
          payslip: {
            salaryStructureId: existingRule.salaryStructureId,
          },
        },
      });

      if (usageInPayslips) {
        res.status(400).json({
          message:
            `Rule '${existingRule.name}' (${existingRule.code}) has been used in previous payroll runs. Set status to INACTIVE instead to preserve payroll history.`,
        });
        return;
      }

      await prisma.salaryRule.delete({ where: { id } });
      res.json({ message: 'Salary rule deleted successfully' });
    } catch (err) {
      console.error('Delete salary rule error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
