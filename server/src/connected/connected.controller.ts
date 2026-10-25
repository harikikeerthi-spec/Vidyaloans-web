import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { ConnectedService } from './connected.service';
import { CreateCohortApplicationDto } from './dto/create-cohort-application.dto';
import { StaffGuard } from '../auth/staff.guard';

@Controller('connected')
export class ConnectedController {
    constructor(private readonly connectedService: ConnectedService) { }

    @Post('apply')
    @HttpCode(HttpStatus.CREATED)
    create(@Body() dto: CreateCohortApplicationDto) {
        if (!dto || !dto.email) {
            return {
                success: false,
                message: 'Application data and email are required',
            };
        }
        return this.connectedService.create(dto);
    }

    /** GET /api/connected/applications?status=pending — admin */
    @Get('applications')
    @UseGuards(StaffGuard)
    findAll(@Query('status') status?: string) {
        return this.connectedService.findAll(status);
    }

    @Patch('applications/:id/status')
    @UseGuards(StaffGuard)
    updateStatus(
        @Param('id') id: string,
        @Body()
        body: { status: string; reviewedBy?: string; reviewNotes?: string },
    ) {
        if (!body || !body.status) {
            return {
                success: false,
                message: 'Status is required',
            };
        }
        return this.connectedService.updateStatus(
            id,
            body.status,
            body.reviewedBy,
            body.reviewNotes,
        );
    }
}
