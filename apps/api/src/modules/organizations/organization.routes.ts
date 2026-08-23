import { Router, type Router as ExpressRouter } from 'express';
import * as OrganizationController from './organization.controller';

const router: ExpressRouter = Router();

router.get('/organizations', OrganizationController.listMyOrganizations);
router.get('/organizations/current', OrganizationController.getCurrentOrganization);
router.get('/organizations/current/members', OrganizationController.listMembers);
router.post('/organizations/current/invites', OrganizationController.inviteMember);
router.post('/organizations/invites/accept', OrganizationController.acceptInvite);
router.patch('/organizations/current/members/:membershipId', OrganizationController.updateMember);
router.get('/billing/status', OrganizationController.getBillingStatus);
router.post('/billing/checkout', OrganizationController.createBillingCheckout);

export { router as organizationRouter };
