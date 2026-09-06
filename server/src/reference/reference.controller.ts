import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { AdminGuard } from '../auth/admin.guard';

@Controller('reference')
export class ReferenceController {
    constructor(private referenceService: ReferenceService) { }

    // ==================== LOAN TYPES ====================

    /**
     * Get all loan types
     * GET /reference/loan-types
     */
    @Get('loan-types')
    async getAllLoanTypes() {
        return this.referenceService.getAllLoanTypes();
    }

    /**
     * Get popular loan types
     * GET /reference/loan-types/popular
     */
    @Get('loan-types/popular')
    async getPopularLoanTypes() {
        return this.referenceService.getPopularLoanTypes();
    }

    /**
     * Get loan type by ID
     * GET /reference/loan-types/:id
     */
    @Get('loan-types/:id')
    async getLoanTypeById(@Param('id') id: string) {
        return this.referenceService.getLoanTypeById(id);
    }

    // ==================== UNIVERSITIES ====================

    /**
     * Get all universities with filters
     * GET /reference/universities
     * @query country - Filter by country
     * @query ranking - Filter by ranking (returns universities with ranking <= value)
     * @query limit - Number of results (default: 20)
     * @query offset - Skip results (default: 0)
     */
    @Get('universities')
    async getAllUniversities(
        @Query('country') country?: string,
        @Query('ranking') ranking?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.referenceService.getAllUniversities({
            country,
            ranking,
            limit: limit ? parseInt(limit, 10) : 20,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Get featured universities
     * GET /reference/universities/featured
     * @query limit - Number of universities (default: 10)
     */
    @Get('universities/featured')
    async getFeaturedUniversities(@Query('limit') limit?: string) {
        return this.referenceService.getFeaturedUniversities(
            limit ? parseInt(limit, 10) : 10,
        );
    }

    /**
     * Get university by ID
     * GET /reference/universities/:id
     */
    @Get('universities/:id')
    async getUniversityById(@Param('id') id: string) {
        return this.referenceService.getUniversityById(id);
    }

    /**
     * Get universities by country
     * GET /reference/universities/country/:country
     */
    @Get('universities/country/:country')
    async getUniversitiesByCountry(@Param('country') country: string) {
        return this.referenceService.getUniversitiesByCountry(country);
    }

    /**
     * Get dynamic total disbursed amount across all banks
     * GET /reference/disbursed-amount
     */
    @Get('disbursed-amount')
    async getDisbursedAmount() {
        return this.referenceService.getDisbursedAmount();
    }

    /**
     * Get dynamic platform statistics (students count, countries count, programs count)
     * GET /reference/platform-stats
     */
    @Get('platform-stats')
    async getPlatformStats() {
        return this.referenceService.getPlatformStats();
    }

    // ==================== BANKS ====================

    /**
     * Get all banks
     * GET /reference/banks
     */
    @Get('banks')
    async getAllBanks() {
        return this.referenceService.getAllBanks();
    }

    /**
     * Get popular banks
     * GET /reference/banks/popular
     */
    @Get('banks/popular')
    async getPopularBanks() {
        return this.referenceService.getPopularBanks();
    }

    /**
     * Get bank by ID
     * GET /reference/banks/:id
     */
    @Get('banks/:id')
    async getBankById(@Param('id') id: string) {
        return this.referenceService.getBankById(id);
    }

    /**
     * Get bank by slug
     * GET /reference/banks/slug/:slug
     */
    @Get('banks/slug/:slug')
    async getBankBySlug(@Param('slug') slug: string) {
        return this.referenceService.getBankBySlug(slug);
    }

    /**
     * Create a new bank
     * POST /reference/banks
     */
    @Post('banks')
    @UseGuards(AdminGuard)
    async createBank(@Body() body: any) {
        return this.referenceService.createBank(body);
    }

    /**
     * Update an existing bank
     * PUT /reference/banks/:id
     */
    @Put('banks/:id')
    @UseGuards(AdminGuard)
    async updateBank(@Param('id') id: string, @Body() body: any) {
        return this.referenceService.updateBank(id, body);
    }

    /**
     * Delete a bank
     * DELETE /reference/banks/:id
     */
    @Delete('banks/:id')
    @UseGuards(AdminGuard)
    async deleteBank(@Param('id') id: string) {
        return this.referenceService.deleteBank(id);
    }

    /**
     * Get banks by type
     * GET /reference/banks/type/:type
     * @param type - Bank type (Public, Private, NBFC)
     */
    @Get('banks/type/:type')
    async getBanksByType(@Param('type') type: string) {
        return this.referenceService.getBanksByType(type);
    }

    // ==================== COUNTRIES ====================

    /**
     * Get all countries
     * GET /reference/countries
     */
    @Get('countries')
    async getAllCountries() {
        return this.referenceService.getAllCountries();
    }

    /**
     * Get popular study destinations
     * GET /reference/countries/popular
     */
    @Get('countries/popular')
    async getPopularCountries() {
        return this.referenceService.getPopularCountries();
    }

    /**
     * Get country by ID
     * GET /reference/countries/:id
     */
    @Get('countries/:id')
    async getCountryById(@Param('id') id: string) {
        return this.referenceService.getCountryById(id);
    }

    /**
     * Get country by code
     * GET /reference/countries/code/:code
     * @param code - Country code (e.g., US, UK, IN)
     */
    @Get('countries/code/:code')
    async getCountryByCode(@Param('code') code: string) {
        return this.referenceService.getCountryByCode(code);
    }

    /**
     * Get countries by region
     * GET /reference/countries/region/:region
     * @param region - Region (e.g., Europe, Asia, North America)
     */
    @Get('countries/region/:region')
    async getCountriesByRegion(@Param('region') region: string) {
        return this.referenceService.getCountriesByRegion(region);
    }

    /**
     * Create a new country (Admin)
     * POST /reference/countries
     */
    @Post('countries')
    async createCountry(@Body() body: any) {
        return this.referenceService.createCountry(body);
    }

    /**
     * Update country details or toggle status (Admin)
     * PUT /reference/countries/:id
     */
    @Put('countries/:id')
    async updateCountry(@Param('id') id: string, @Body() body: any) {
        return this.referenceService.updateCountry(id, body);
    }

    /**
     * Delete a country (Admin)
     * DELETE /reference/countries/:id
     */
    @Delete('countries/:id')
    async deleteCountry(@Param('id') id: string) {
        return this.referenceService.deleteCountry(id);
    }

    // ==================== SCHOLARSHIPS ====================

    /**
     * Get all scholarships with filters
     * GET /reference/scholarships
     * @query country - Filter by country
     * @query type - Filter by type (Merit-based, Need-based, Sports)
     * @query limit - Number of results (default: 20)
     * @query offset - Skip results (default: 0)
     */
    @Get('scholarships')
    async getAllScholarships(
        @Query('country') country?: string,
        @Query('type') type?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.referenceService.getAllScholarships({
            country,
            type,
            limit: limit ? parseInt(limit, 10) : 20,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Get scholarship by ID
     * GET /reference/scholarships/:id
     */
    @Get('scholarships/:id')
    async getScholarshipById(@Param('id') id: string) {
        return this.referenceService.getScholarshipById(id);
    }

    /**
     * Get scholarships by country
     * GET /reference/scholarships/country/:country
     */
    @Get('scholarships/country/:country')
    async getScholarshipsByCountry(@Param('country') country: string) {
        return this.referenceService.getScholarshipsByCountry(country);
    }

    // ==================== COURSES ====================

    /**
     * Get all courses with filters
     * GET /reference/courses
     * @query level - Filter by level (Undergraduate, Masters, PhD)
     * @query field - Filter by field (Engineering, Business, Medicine)
     * @query limit - Number of results (default: 20)
     * @query offset - Skip results (default: 0)
     */
    @Get('courses')
    async getAllCourses(
        @Query('level') level?: string,
        @Query('field') field?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.referenceService.getAllCourses({
            level,
            field,
            limit: limit ? parseInt(limit, 10) : 20,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    /**
     * Get popular courses
     * GET /reference/courses/popular
     */
    @Get('courses/popular')
    async getPopularCourses() {
        return this.referenceService.getPopularCourses();
    }

    /**
     * Get course by ID
     * GET /reference/courses/:id
     */
    @Get('courses/:id')
    async getCourseById(@Param('id') id: string) {
        return this.referenceService.getCourseById(id);
    }

    /**
     * Get courses by level
     * GET /reference/courses/level/:level
     * @param level - Course level (Undergraduate, Masters, PhD)
     */
    @Get('courses/level/:level')
    async getCoursesByLevel(@Param('level') level: string) {
        return this.referenceService.getCoursesByLevel(level);
    }

    /**
     * Get courses by field
     * GET /reference/courses/field/:field
     * @param field - Field of study (Engineering, Business, Medicine)
     */
    @Get('courses/field/:field')
    async getCoursesByField(@Param('field') field: string) {
        return this.referenceService.getCoursesByField(field);
    }

    // ==================== OFFICES ====================

    /**
     * Get all offices
     * GET /reference/offices
     */
    @Get('offices')
    async getAllOffices() {
        return this.referenceService.getAllOffices();
    }

    /**
     * Create office
     * POST /reference/offices
     */
    @UseGuards(AdminGuard)
    @Post('offices')
    async createOffice(@Body() body: { name: string; city: string; location: string }) {
        return this.referenceService.createOffice(body);
    }

    /**
     * Update office
     * PUT /reference/offices/:id
     */
    @UseGuards(AdminGuard)
    @Put('offices/:id')
    async updateOffice(
        @Param('id') id: string,
        @Body() body: { name?: string; city?: string; location?: string; isActive?: boolean }
    ) {
        return this.referenceService.updateOffice(id, body);
    }

    /**
     * Delete office
     * DELETE /reference/offices/:id
     */
    @UseGuards(AdminGuard)
    @Delete('offices/:id')
    async deleteOffice(@Param('id') id: string) {
        return this.referenceService.deleteOffice(id);
    }
}
